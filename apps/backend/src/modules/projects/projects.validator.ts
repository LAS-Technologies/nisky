import { z } from "zod";

export const idParamSchema = z.object({ id: z.uuid("El identificador no es válido") });
const dateValue = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "La fecha no es válida");

export const createProjectSchema = z.object({
  name: z.string("El nombre es requerido").trim().min(1, "El nombre es requerido").max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  targetDate: dateValue.nullable().optional(),
  color: z.string().trim().max(20).optional(),
  weeklyTargetMinutes: z.number().int().min(0).max(10080).nullable().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectIdParamSchema = z.object({ projectId: z.uuid("El proyecto no es válido") });
export const invitationIdParamSchema = z.object({ invitationId: z.uuid("La invitación no es válida") });
export const inviteTokenParamSchema = z.object({
  token: z.string().trim().min(20, "El enlace de invitación no es válido").max(160, "El enlace de invitación no es válido"),
});
export const memberIdParamSchema = z.object({
  projectId: z.uuid("El proyecto no es válido"),
  memberId: z.uuid("El miembro no es válido"),
});
export const resourceIdParamSchema = z.object({
  projectId: z.uuid("El proyecto no es válido"),
  resourceId: z.uuid("El recurso no es válido"),
});
export const inviteMemberSchema = z.object({
  identifier: z
    .string("El email o @usuario es requerido")
    .trim()
    .min(1, "El email o @usuario es requerido")
    .max(120, "Identificador demasiado largo"),
});
export const updateMemberRoleSchema = z.object({ role: z.enum(["OWNER", "MEMBER"]) });
export const projectActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export const createResourceSchema = z.object({
  title: z.string("El título es requerido").trim().min(1, "El título es requerido").max(200),
  url: z.url("La URL no es válida").max(2000),
  description: z.string().trim().max(500).nullable().optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
export type ProjectActivityQueryDto = z.infer<typeof projectActivityQuerySchema>;
export type CreateResourceDto = z.infer<typeof createResourceSchema>;
