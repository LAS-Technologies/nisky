import type { Prisma } from "../../infra/prisma/generated/prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../infra/prisma/client";
import { AppError } from "../../utils/errors/handler";
import { pushService } from "../push/push.service";
import { assertProjectAccess, assertProjectOwner, getProjectAudience, getUserRoleInProject } from "./access";
import { projectActivityService } from "./project-activity.service";
import type { CreateProjectDto, UpdateProjectDto } from "./projects.validator";
import { emitToUsers } from "../../config/socket.emit";

const DEFAULT_COLOR = "#303e51";
const PROJECT_MEMBER_USER_SELECT = { id: true, email: true, name: true, username: true, avatarUrl: true };
const PROJECT_INVITE_PREFIX = "nisky_inv_";

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function projectDate(value: string | null | undefined) {
  if (value === undefined || value === null) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00.000Z`);
  return new Date(value);
}

export class ProjectService {
  private defaultCache = new Map<string, string | null>();

  async list(userId: string) {
    const merged = await this.listUserProjects(userId);
    // Mezclar sin duplicar
    const map = new Map<string, (typeof merged)[number]>();
    for (const p of merged) map.set(p.id, p);
    return [...map.values()].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  async getById(userId: string, projectId: string) {
    await assertProjectAccess(userId, projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    return project;
  }

  async getSummary(userId: string, projectId: string) {
    await assertProjectAccess(userId, projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");

    const now = new Date();
    const taskWhere = { projectId, archivedAt: null };
    const [members, statusGroups, totalTasks, completedTasks, overdueTasks, upcomingTasks, assigneeGroups, role] = await Promise.all([
      this.listMembers(userId, projectId),
      prisma.task.groupBy({ where: taskWhere, by: ["status"], _count: { _all: true } }),
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: { ...taskWhere, status: "COMPLETED" } }),
      prisma.task.count({ where: { ...taskWhere, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { lt: now } } }),
      prisma.task.findMany({
        where: { ...taskWhere, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { not: null, gte: now } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: 5,
        include: {
          user: { select: PROJECT_MEMBER_USER_SELECT },
          assignee: { select: PROJECT_MEMBER_USER_SELECT },
          _count: { select: { comments: true } },
        },
      }),
      prisma.task.groupBy({ where: { ...taskWhere, status: { notIn: ["COMPLETED", "CANCELLED"] } }, by: ["assigneeId"], _count: { _all: true } }),
      getUserRoleInProject(userId, projectId),
    ]);

    const counts = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const group of statusGroups) counts[group.status] = group._count._all;
    const assignedCount = new Map(assigneeGroups.map((group) => [group.assigneeId, group._count._all]));
    const taskCountsByMember = members.map((member) => ({
      userId: member.userId,
      count: assignedCount.get(member.userId) ?? 0,
      user: member.user,
      role: member.role,
    }));

    return {
      project,
      permissions: {
        role,
        canEditProject: role === "OWNER",
        canDeleteProject: role === "OWNER" && !project.isDefault,
        canManageMembers: role === "OWNER" && !project.isDefault,
        canCreateTasks: role !== null,
        canEditTasks: role !== null,
      },
      members,
      totalTasks,
      counts: { ...counts, completed: completedTasks, overdue: overdueTasks },
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      upcomingTasks: upcomingTasks.map((task) => ({
        ...task,
        commentCount: task._count.comments,
        _count: undefined,
      })),
      taskCountsByMember,
    };
  }

  async getDefault(userId: string) {
    return prisma.project.findFirst({ where: { userId, isDefault: true } });
  }

  async getDefaultId(userId: string) {
    if (this.defaultCache.has(userId)) return this.defaultCache.get(userId);
    const project = await this.getDefault(userId);
    this.defaultCache.set(userId, project?.id ?? null);
    return project?.id ?? null;
  }

  async create(userId: string, data: CreateProjectDto) {
    const count = await prisma.project.count({ where: { userId } });
    if (count >= 20) throw new AppError("BAD_REQUEST", "Has alcanzado el límite de proyectos");
    const project = await prisma.project.create({
      data: {
        userId,
        name: data.name,
        description: data.description ?? null,
        targetDate: projectDate(data.targetDate),
        color: data.color ?? DEFAULT_COLOR,
        isDefault: false,
        weeklyTargetMinutes: data.weeklyTargetMinutes ?? null,
      },
    });
    await projectActivityService.record({ projectId: project.id, actorId: userId, type: "PROJECT_CREATED", entityId: project.id, entityTitle: project.name });
    return project;
  }

  async update(userId: string, id: string, data: UpdateProjectDto) {
    const role = await getUserRoleInProject(userId, id);
    if (!role) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (role !== "OWNER") throw new AppError("FORBIDDEN", "Solo el propietario puede editar el proyecto");
    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (project.isDefault && data.name !== undefined && data.name !== project.name) {
      throw new AppError("FORBIDDEN", "El proyecto por defecto no se puede renombrar");
    }
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.targetDate !== undefined ? { targetDate: projectDate(data.targetDate) } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.weeklyTargetMinutes !== undefined ? { weeklyTargetMinutes: data.weeklyTargetMinutes } : {}),
      },
    });
    await projectActivityService.record({
      projectId: id,
      actorId: userId,
      type: "PROJECT_UPDATED",
      entityId: id,
      entityTitle: updated.name,
      metadata: { fields: Object.keys(data) },
    });
    emitToUsers(await getProjectAudience(id), "projects", { kind: "project", projectId: id });
    return updated;
  }

  async setDefault(userId: string, id: string) {
    const role = await getUserRoleInProject(userId, id);
    if (!role) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (role !== "OWNER") throw new AppError("FORBIDDEN", "Solo el propietario puede cambiar el proyecto predeterminado");
    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (project.isDefault) return project;
    const [, updated] = await prisma.$transaction([
      prisma.project.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      prisma.project.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return updated;
  }

  async delete(userId: string, id: string) {
    await assertProjectOwner(userId, id);
    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (project.isDefault) throw new AppError("FORBIDDEN", "El proyecto por defecto no se puede eliminar");
    const fallback = await this.getDefault(userId);
    if (!fallback) throw new AppError("CONFLICT", "No existe un proyecto por defecto");
    await prisma.$transaction([
      prisma.task.updateMany({ where: { userId, projectId: id }, data: { projectId: fallback.id } }),
      prisma.timeBlock.updateMany({ where: { userId, projectId: id }, data: { projectId: null } }),
      prisma.projectInvitation.deleteMany({ where: { projectId: id } }),
      prisma.projectMember.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ]);
    if (this.defaultCache.get(userId) === id) this.defaultCache.delete(userId);
    return { success: true, fallbackProjectId: fallback.id };
  }

  async listUserProjects(userId: string) {
    const projectInclude = {
      _count: { select: { tasks: { where: { archivedAt: null, status: "PENDING" } } } },
      members: {
        take: 4,
        include: { user: { select: { id: true, email: true, name: true, username: true, avatarUrl: true } } },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      },
    } satisfies Prisma.ProjectInclude;
    const [owned, memberships] = await Promise.all([
      prisma.project.findMany({ where: { userId }, include: projectInclude, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
      prisma.projectMember.findMany({
        where: { userId },
        include: { project: { include: projectInclude } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const memberProjects = memberships.map(m => m.project);
    const seen = new Set<string>();
    const projects = [...owned, ...memberProjects].filter((project) => {
      if (seen.has(project.id)) return false;
      seen.add(project.id);
      return true;
    });
    const ownerIds = [...new Set(projects.map(p => p.userId))];
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, email: true, name: true, username: true, avatarUrl: true },
    });
    const ownerById = new Map(owners.map(o => [o.id, o]));
    for (const project of projects) {
      const hasOwner = project.members.some(m => m.userId === project.userId);
      if (!hasOwner) {
        const owner = ownerById.get(project.userId);
        if (owner) {
          project.members.unshift({
            id: `owner-${owner.id}`,
            projectId: project.id,
            userId: owner.id,
            user: owner,
            role: "OWNER",
            createdAt: new Date(0),
          });
        }
      }
    }
    return projects;
  }

  async listMembers(userId: string, projectId: string) {
    await assertProjectAccess(userId, projectId);
    const [members, project] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, email: true, name: true, username: true, avatarUrl: true } } },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      }),
      prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } }),
    ]);
    // Incluir al owner como miembro virtual si no está en la tabla
    const ownerInMembers = members.some(m => m.userId === project?.userId);
    if (project && !ownerInMembers) {
      const owner = await prisma.user.findUnique({
        where: { id: project.userId },
        select: { id: true, email: true, name: true, username: true, avatarUrl: true },
      });
      if (owner) {
        members.unshift({
          id: `owner-${owner.id}`,
          projectId,
          userId: owner.id,
          user: owner,
          role: "OWNER",
          createdAt: new Date(0),
        });
      }
    }
    return members;
  }

  async inviteMember(userId: string, projectId: string, identifier: string) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (project.isDefault) throw new AppError("FORBIDDEN", "El proyecto por defecto no se puede compartir");

    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });

    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const lookup = looksLikeEmail
      ? { email: identifier.toLowerCase() }
      : { username: identifier.replace(/^@/, "").toLowerCase() };
    const invitee = await prisma.user.findUnique({ where: lookup, select: { id: true, name: true, email: true, username: true } });
    if (!invitee) {
      throw new AppError(
        "NOT_FOUND",
        looksLikeEmail ? "El usuario no existe en Nisky" : "Ese usuario no existe en Nisky",
      );
    }
    if (invitee.id === userId) throw new AppError("BAD_REQUEST", "No puedes invitarte a ti mismo");

    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: invitee.id } },
    });
    if (existingMember) throw new AppError("CONFLICT", "El usuario ya es miembro");

    const existingInvite = await prisma.projectInvitation.findUnique({
      where: { projectId_email: { projectId, email: invitee.email } },
    });
    if (existingInvite && existingInvite.status === "PENDING")
      throw new AppError("CONFLICT", "Ya hay una invitación pendiente para este email");

    // Si existe una ACCEPTED o DECLINED anterior, la reemplazamos
    if (existingInvite) {
      await prisma.projectInvitation.delete({ where: { id: existingInvite.id } });
    }

    const invitation = await prisma.projectInvitation.create({
      data: { projectId, invitedById: userId, email: invitee.email },
    });

    await pushService.sendToUser(invitee.id, {
      title: "Nueva invitación a proyecto",
      body: `${inviter?.name ?? inviter?.email} te invitó a "${project.name}"`,
      url: "/",
      tag: `invite-${project.id}`,
      data: { type: "PROJECT_INVITATION", projectId: project.id },
    });

    emitToUsers([invitee.id, ...(await getProjectAudience(projectId))], "projects", { kind: "invitation", projectId });

    return invitation;
  }

  async createInviteLink(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true, isDefault: true } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (project.isDefault) throw new AppError("FORBIDDEN", "El proyecto por defecto no se puede compartir");

    const token = `${PROJECT_INVITE_PREFIX}${randomBytes(32).toString("base64url")}`;
    const link = await prisma.projectInviteLink.create({
      data: { projectId, createdById: userId, tokenHash: hashInviteToken(token) },
      select: { id: true, createdAt: true },
    });
    return { ...link, token };
  }

  async getInviteLink(token: string) {
    const link = await prisma.projectInviteLink.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: {
        revokedAt: true,
        project: { select: { id: true, name: true, description: true, color: true, isDefault: true } },
      },
    });
    if (!link || link.revokedAt || link.project.isDefault) throw new AppError("NOT_FOUND", "El enlace de invitación no existe o ya no está disponible");
    return { project: link.project };
  }

  async acceptInviteLink(userId: string, token: string) {
    const link = await prisma.projectInviteLink.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: { revokedAt: true, project: { select: { id: true, userId: true, name: true, isDefault: true } } },
    });
    if (!link || link.revokedAt || link.project.isDefault) throw new AppError("NOT_FOUND", "El enlace de invitación no existe o ya no está disponible");

    const { project } = link;
    if (project.userId === userId) return { success: true, projectId: project.id, alreadyMember: true };

    const existingMember = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId } } });
    if (existingMember) return { success: true, projectId: project.id, alreadyMember: true };

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } });
    if (!user) throw new AppError("NOT_FOUND", "Usuario no encontrado");
    await prisma.projectMember.create({ data: { projectId: project.id, userId, role: "MEMBER" } });
    await projectActivityService.record({
      projectId: project.id,
      actorId: userId,
      type: "MEMBER_ADDED",
      entityId: userId,
      entityTitle: user.username ? `@${user.username}` : user.email,
    });
    await pushService.sendToUser(project.userId, {
      title: "Nuevo miembro en tu proyecto",
      body: `${user.username ? `@${user.username}` : user.email} se unió a "${project.name}"`,
      url: `/projects/${project.id}?tab=team`,
      tag: `invite-link-accepted-${project.id}`,
      data: { type: "PROJECT_INVITATION_ACCEPTED", projectId: project.id },
    });
    emitToUsers(await getProjectAudience(project.id), "projects", { kind: "invitation_accepted", projectId: project.id, userId });
    return { success: true, projectId: project.id, alreadyMember: false };
  }

  async listPendingInvitations(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return [];
    return prisma.projectInvitation.findMany({
      where: { email: user.email, status: "PENDING" },
      include: {
        project: { select: { id: true, name: true, color: true, userId: true } },
        invitedBy: { select: { id: true, email: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listProjectInvitations(userId: string, projectId: string) {
    await assertProjectAccess(userId, projectId);
    const invitations = await prisma.projectInvitation.findMany({
      where: { projectId, status: "PENDING" },
      include: {
        invitedBy: { select: { id: true, email: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const inviteeEmails = [...new Set(invitations.map((invitation) => invitation.email).filter((email): email is string => Boolean(email)))];
    const invitees = await prisma.user.findMany({
      where: { email: { in: inviteeEmails } },
      select: { id: true, email: true, name: true, username: true, avatarUrl: true },
    });
    const inviteeByEmail = new Map(invitees.map((invitee) => [invitee.email, invitee]));
    return invitations.map((invitation) => ({
      id: invitation.id,
      projectId: invitation.projectId,
      email: invitation.email,
      status: invitation.status,
      createdAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
      invitee: invitation.email ? inviteeByEmail.get(invitation.email) ?? null : null,
    }));
  }

  async cancelInvitation(userId: string, invitationId: string) {
    const invitation = await prisma.projectInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new AppError("NOT_FOUND", "Invitación no encontrada");
    await assertProjectOwner(userId, invitation.projectId);
    await prisma.projectInvitation.delete({ where: { id: invitationId } });
    emitToUsers([...(await getProjectAudience(invitation.projectId))], "projects", { kind: "invitation_cancelled", projectId: invitation.projectId });
    return { success: true };
  }

  async acceptInvitation(userId: string, invitationId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } });
    if (!user) throw new AppError("NOT_FOUND", "Usuario no encontrado");
    const invitation = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, email: user.email, status: "PENDING" },
    });
    if (!invitation) throw new AppError("NOT_FOUND", "No hay invitación pendiente");
    const projectId = invitation.projectId;
    await prisma.$transaction([
      prisma.projectMember.create({ data: { projectId, userId, role: "MEMBER" } }),
      prisma.projectInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } }),
    ]);
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true, name: true } });
    if (project) {
      await projectActivityService.record({
        projectId,
        actorId: project.userId,
        type: "MEMBER_ADDED",
        entityId: userId,
        entityTitle: user.username ? `@${user.username}` : user.email,
      });
      await pushService.sendToUser(project.userId, {
        title: "Invitación aceptada",
        body: `${user.username ? `@${user.username}` : user.email} aceptó tu invitación a "${project.name}"`,
        url: `/projects`,
        tag: `invite-accepted-${projectId}`,
        data: { type: "PROJECT_INVITATION_ACCEPTED", projectId },
      });
    }
    emitToUsers([...(await getProjectAudience(projectId))], "projects", { kind: "invitation_accepted", projectId });
    return { success: true };
  }

  async declineInvitation(userId: string, invitationId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new AppError("NOT_FOUND", "Usuario no encontrado");
    const invitation = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, email: user.email, status: "PENDING" },
    });
    if (!invitation) throw new AppError("NOT_FOUND", "No hay invitación pendiente");
    await prisma.projectInvitation.update({ where: { id: invitation.id }, data: { status: "DECLINED" } });
    return { success: true };
  }

  async removeMember(userId: string, projectId: string, memberId: string) {
    await assertProjectOwner(userId, projectId);
    const project = await prisma.project.findFirst({ where: { id: projectId }, select: { isDefault: true } });
    if (project?.isDefault) throw new AppError("FORBIDDEN", "El proyecto por defecto es personal y no tiene miembros");
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new AppError("NOT_FOUND", "Miembro no encontrado");
    if (member.userId === userId) throw new AppError("FORBIDDEN", "No puedes eliminarte a ti mismo");
    await prisma.$transaction([
      prisma.task.updateMany({ where: { projectId, assigneeId: member.userId }, data: { assigneeId: null } }),
      prisma.task.updateMany({ where: { projectId, userId: member.userId }, data: { userId } }),
      prisma.projectMember.delete({ where: { id: member.id } }),
    ]);
    await projectActivityService.record({ projectId, actorId: userId, type: "MEMBER_REMOVED", entityId: member.userId });
    emitToUsers([member.userId, ...(await getProjectAudience(projectId))], "projects", { kind: "member_removed", projectId, userId: member.userId });
    return { success: true };
  }

  async leave(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({ where: { id: projectId }, select: { userId: true, isDefault: true } });
    if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    if (project.userId === userId) throw new AppError("FORBIDDEN", "El propietario no puede salirse del proyecto");
    if (project.isDefault) throw new AppError("FORBIDDEN", "El proyecto por defecto es personal");
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new AppError("NOT_FOUND", "No eres miembro de este proyecto");
    await prisma.$transaction([
      prisma.task.updateMany({ where: { projectId, assigneeId: userId }, data: { assigneeId: null } }),
      prisma.task.updateMany({ where: { projectId, userId }, data: { userId: project.userId } }),
      prisma.projectMember.delete({ where: { id: member.id } }),
    ]);
    await projectActivityService.record({ projectId, actorId: userId, type: "MEMBER_REMOVED", entityId: userId });
    emitToUsers(await getProjectAudience(projectId), "projects", { kind: "member_removed", projectId, userId });
    return { success: true };
  }

  async updateMemberRole(userId: string, projectId: string, memberId: string, role: "OWNER" | "MEMBER") {
    await assertProjectOwner(userId, projectId);
    const project = await prisma.project.findFirst({ where: { id: projectId }, select: { isDefault: true } });
    if (project?.isDefault) throw new AppError("FORBIDDEN", "El proyecto por defecto es personal y no tiene miembros");
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new AppError("NOT_FOUND", "Miembro no encontrado");
    if (member.userId === userId) throw new AppError("FORBIDDEN", "No puedes cambiar tu propio rol");
    if (role === "OWNER") {
      await prisma.$transaction([
        prisma.project.update({ where: { id: projectId }, data: { userId: member.userId } }),
        prisma.projectMember.update({ where: { id: member.id }, data: { role: "OWNER" } }),
        prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, role: "MEMBER" },
          update: { role: "MEMBER" },
        }),
      ]);
    } else {
      await prisma.projectMember.update({
        where: { id: member.id },
        data: { role: "MEMBER" },
      });
    }
    await projectActivityService.record({ projectId, actorId: userId, type: "MEMBER_ROLE_CHANGED", entityId: member.userId, metadata: { role } });
    emitToUsers(await getProjectAudience(projectId), "projects", { kind: "member_role_changed", projectId, userId: member.userId, role });
    return { success: true };
  }
}

export const projectService = new ProjectService();
