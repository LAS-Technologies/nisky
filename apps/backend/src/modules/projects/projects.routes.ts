import { Router } from "express";
import { requireAuth, requireScopes } from "../../middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate.middleware";
import { ProjectController } from "./projects.controller";
import {
  createProjectSchema, idParamSchema, invitationIdParamSchema, inviteMemberSchema, memberIdParamSchema,
  inviteTokenParamSchema, projectActivityQuerySchema, projectIdParamSchema, resourceIdParamSchema, createResourceSchema, updateProjectSchema, updateMemberRoleSchema,
} from "./projects.validator";

const router = Router();
const controller = new ProjectController();

router.get("/invite-links/:token", validateParams(inviteTokenParamSchema), controller.getInviteLink);
router.use(requireAuth);
const read = requireScopes("projects:read");
const write = requireScopes("projects:write");
router.get("/", read, controller.list);
router.get("/accessible", read, controller.listUserProjects);
router.get("/invitations/pending", read, controller.listPendingInvitations);
router.post("/invitations/:invitationId/accept", write, validateParams(invitationIdParamSchema), controller.acceptInvitation);
router.post("/invitations/:invitationId/decline", write, validateParams(invitationIdParamSchema), controller.declineInvitation);
router.delete("/invitations/:invitationId", write, validateParams(invitationIdParamSchema), controller.cancelInvitation);
router.post("/", write, validateBody(createProjectSchema), controller.create);
router.post("/:id/leave", write, validateParams(idParamSchema), controller.leave);
router.get("/:id/summary", read, validateParams(idParamSchema), controller.summary);
router.get("/:id", read, validateParams(idParamSchema), controller.getById);
router.patch("/:id", write, validateParams(idParamSchema), validateBody(updateProjectSchema), controller.update);
router.patch("/:id/default", write, validateParams(idParamSchema), controller.setDefault);
router.delete("/:id", write, validateParams(idParamSchema), controller.delete);
router.get("/:projectId/members", read, validateParams(projectIdParamSchema), controller.listMembers);
router.get("/:projectId/invitations", read, validateParams(projectIdParamSchema), controller.listProjectInvitations);
router.post("/:projectId/invitations", write, validateParams(projectIdParamSchema), validateBody(inviteMemberSchema), controller.inviteMember);
router.post("/:projectId/invite-links", write, validateParams(projectIdParamSchema), controller.createInviteLink);
router.post("/invite-links/:token/accept", write, validateParams(inviteTokenParamSchema), controller.acceptInviteLink);
router.delete("/:projectId/members/:memberId", write, validateParams(memberIdParamSchema), controller.removeMember);
router.patch("/:projectId/members/:memberId/role", write, validateParams(memberIdParamSchema), validateBody(updateMemberRoleSchema), controller.updateMemberRole);
router.get("/:projectId/activity", read, validateParams(projectIdParamSchema), validateQuery(projectActivityQuerySchema), controller.listActivity);
router.get("/:projectId/resources", read, validateParams(projectIdParamSchema), controller.listResources);
router.post("/:projectId/resources", write, validateParams(projectIdParamSchema), validateBody(createResourceSchema), controller.createResource);
router.delete("/:projectId/resources/:resourceId", write, validateParams(resourceIdParamSchema), controller.deleteResource);

export default router;
