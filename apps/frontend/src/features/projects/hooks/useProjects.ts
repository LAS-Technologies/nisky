import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvitation,
  cancelInvitation,
  createProject,
  createProjectInviteLink,
  declineInvitation,
  deleteProject,
  getAccessibleProjects,
  getPendingInvitations,
  getProject,
  getProjectInviteLinks,
  getProjectInvitations,
  getProjectMembers,
  getProjects,
  inviteProjectMember,
  leaveProject,
  removeAvatar,
  removeProjectMember,
  revokeProjectInviteLink,
  setDefaultProject,
  updateProject,
  updateProjectMemberRole,
  updateProfile,
  uploadAvatar,
  type CreateProjectPayload,
  type UpdateProjectPayload,
} from "../api/projects";
import type { ProjectRole } from "@/types/entities";

export function useProjectsQuery() {
  return useQuery({ queryKey: ["projects"], queryFn: getProjects });
}

export function useAccessibleProjects() {
  return useQuery({ queryKey: ["projects", "accessible"], queryFn: getAccessibleProjects });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => getProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => getProjectMembers(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectInvitations(projectId: string | null) {
  return useQuery({
    queryKey: ["projects", projectId, "invitations"],
    queryFn: () => getProjectInvitations(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectInviteLinks(projectId: string | null) {
  return useQuery({
    queryKey: ["projects", projectId, "invite-links"],
    queryFn: () => getProjectInviteLinks(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function usePendingInvitations() {
  return useQuery({
    queryKey: ["invitations", "pending"],
    queryFn: getPendingInvitations,
    refetchInterval: 30_000,
  });
}

export function useProjectMemberMutations(projectId: string) {
  const client = useQueryClient();
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
    await client.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] });
    await client.invalidateQueries({ queryKey: ["projects", projectId, "invite-links"] });
    await client.invalidateQueries({ queryKey: ["projects", projectId, "summary"] });
    await client.invalidateQueries({ queryKey: ["projects", projectId, "activity"] });
    await client.invalidateQueries({ queryKey: ["invitations", "pending"] });
    await client.invalidateQueries({ queryKey: ["projects"] });
    await client.invalidateQueries({ queryKey: ["tasks"] });
  };
  const invite = useMutation({
    mutationFn: (identifier: string) => inviteProjectMember(projectId, identifier),
    onSuccess: invalidate,
  });
  const createInviteLink = useMutation({ mutationFn: () => createProjectInviteLink(projectId), onSuccess: invalidate });
  const revokeInviteLink = useMutation({
    mutationFn: ({ linkId }: { linkId: string }) => revokeProjectInviteLink(projectId, linkId),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => removeProjectMember(projectId, memberId),
    onSuccess: invalidate,
  });
  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ProjectRole }) => updateProjectMemberRole(projectId, memberId, role),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: invalidate,
  });
  return { invite, createInviteLink, revokeInviteLink, remove, updateRole, cancel };
}

export function useInvitationMutations() {
  const client = useQueryClient();
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["invitations", "pending"] });
    await client.invalidateQueries({ queryKey: ["projects"] });
    await client.invalidateQueries({ queryKey: ["projects", "accessible"] });
    await client.invalidateQueries({ queryKey: ["tasks"] });
  };
  const accept = useMutation({ mutationFn: acceptInvitation, onSuccess: invalidate });
  const decline = useMutation({ mutationFn: declineInvitation, onSuccess: invalidate });
  return { accept, decline };
}

export function useLeaveProjectMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: leaveProject,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["projects"] });
      await client.invalidateQueries({ queryKey: ["projects", "accessible"] });
      await client.invalidateQueries({ queryKey: ["tasks"] });
      await client.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

export function useProfileMutations() {
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["auth"] });
    },
  });
  const avatar = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["auth"] });
    },
  });
  const removeAvatarMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["auth"] });
    },
  });
  return { update, avatar, removeAvatar: removeAvatarMutation };
}

export function useProjectMutations() {
  const client = useQueryClient();
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["projects"] });
    await client.invalidateQueries({ queryKey: ["tasks"] });
    await client.invalidateQueries({ queryKey: ["timeblocks"] });
    await client.invalidateQueries({ queryKey: ["home"] });
  };
  const create = useMutation({ mutationFn: (payload: CreateProjectPayload) => createProject(payload), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) => updateProject(id, payload), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteProject, onSuccess: invalidate });
  const setDefault = useMutation({ mutationFn: setDefaultProject, onSuccess: invalidate });
  return { create, update, remove, setDefault };
}
