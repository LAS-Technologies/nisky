import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/errors/handler";
import { projectActivityService } from "./project-activity.service";
import { projectResourceService } from "./project-resources.service";
import { projectService } from "./projects.service";
import type { CreateProjectDto, CreateResourceDto, InviteMemberDto, ProjectActivityQueryDto, UpdateMemberRoleDto, UpdateProjectDto } from "./projects.validator";

type IdParams = { id: string };
type ProjectIdParams = { projectId: string };
type MemberIdParams = { projectId: string; memberId: string };
type InvitationIdParams = { invitationId: string };
type InviteTokenParams = { token: string };
type InviteLinkParams = { projectId: string; linkId: string };
type ResourceIdParams = { projectId: string; resourceId: string };

function userId(req: Request) {
  if (!req.user) throw new AppError("UNAUTHORIZED");
  return req.user.id;
}

export class ProjectController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await projectService.list(userId(req))); } catch (error) { next(error); }
  };

  getById = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.getById(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  summary = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.getSummary(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  create = async (req: Request<{}, {}, CreateProjectDto>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.create(userId(req), req.body), 201); } catch (error) { next(error); }
  };

  update = async (req: Request<IdParams, {}, UpdateProjectDto>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.update(userId(req), req.params.id, req.body)); } catch (error) { next(error); }
  };

  setDefault = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.setDefault(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  delete = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.delete(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  leave = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.leave(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  listUserProjects = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await projectService.listUserProjects(userId(req))); } catch (error) { next(error); }
  };

  listMembers = async (req: Request<ProjectIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.listMembers(userId(req), req.params.projectId)); } catch (error) { next(error); }
  };

  inviteMember = async (req: Request<ProjectIdParams, {}, InviteMemberDto>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.inviteMember(userId(req), req.params.projectId, req.body.identifier), 201); } catch (error) { next(error); }
  };

  createInviteLink = async (req: Request<ProjectIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.createInviteLink(userId(req), req.params.projectId), 201); } catch (error) { next(error); }
  };

  listInviteLinks = async (req: Request<ProjectIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.listInviteLinks(userId(req), req.params.projectId)); } catch (error) { next(error); }
  };

  revokeInviteLink = async (req: Request<InviteLinkParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.revokeInviteLink(userId(req), req.params.projectId, req.params.linkId)); } catch (error) { next(error); }
  };

  getInviteLink = async (req: Request<InviteTokenParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.getInviteLink(req.params.token)); } catch (error) { next(error); }
  };

  acceptInviteLink = async (req: Request<InviteTokenParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.acceptInviteLink(userId(req), req.params.token)); } catch (error) { next(error); }
  };

  listPendingInvitations = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await projectService.listPendingInvitations(userId(req))); } catch (error) { next(error); }
  };

  listProjectInvitations = async (req: Request<ProjectIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.listProjectInvitations(userId(req), req.params.projectId)); } catch (error) { next(error); }
  };

  cancelInvitation = async (req: Request<InvitationIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.cancelInvitation(userId(req), req.params.invitationId)); } catch (error) { next(error); }
  };

  acceptInvitation = async (req: Request<InvitationIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.acceptInvitation(userId(req), req.params.invitationId)); } catch (error) { next(error); }
  };

  declineInvitation = async (req: Request<InvitationIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.declineInvitation(userId(req), req.params.invitationId)); } catch (error) { next(error); }
  };

  removeMember = async (req: Request<MemberIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.removeMember(userId(req), req.params.projectId, req.params.memberId)); } catch (error) { next(error); }
  };

  updateMemberRole = async (req: Request<MemberIdParams, {}, UpdateMemberRoleDto>, res: Response, next: NextFunction) => {
    try { res.success(await projectService.updateMemberRole(userId(req), req.params.projectId, req.params.memberId, req.body.role)); } catch (error) { next(error); }
  };

  listActivity = async (req: Request<ProjectIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectActivityService.list(userId(req), req.params.projectId, req.query as unknown as ProjectActivityQueryDto)); } catch (error) { next(error); }
  };

  listResources = async (req: Request<ProjectIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectResourceService.list(userId(req), req.params.projectId)); } catch (error) { next(error); }
  };

  createResource = async (req: Request<ProjectIdParams, {}, CreateResourceDto>, res: Response, next: NextFunction) => {
    try { res.success(await projectResourceService.create(userId(req), req.params.projectId, req.body), 201); } catch (error) { next(error); }
  };

  deleteResource = async (req: Request<ResourceIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await projectResourceService.delete(userId(req), req.params.projectId, req.params.resourceId)); } catch (error) { next(error); }
  };
}
