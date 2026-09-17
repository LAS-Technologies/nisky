import { api } from "@/lib/api";
import type { Project, ProjectInvitation, ProjectInvitePreview, ProjectMember, ProjectRole, User } from "@/types/entities";

export async function getProjects() {
  const { data } = await api.get<{ data: Project[] }>("/projects");
  return data.data;
}

export async function getProject(id: string) {
  const { data } = await api.get<{ data: Project }>(`/projects/${id}`);
  return data.data;
}

export type CreateProjectPayload = {
  name: string;
  description?: string | null;
  targetDate?: string | null;
  color?: string;
  weeklyTargetMinutes?: number | null;
};

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export async function createProject(payload: CreateProjectPayload) {
  const { data } = await api.post<{ data: Project }>("/projects", payload);
  return data.data;
}

export async function updateProject(id: string, payload: UpdateProjectPayload) {
  const { data } = await api.patch<{ data: Project }>(`/projects/${id}`, payload);
  return data.data;
}

export async function deleteProject(id: string) {
  const { data } = await api.delete<{ data: { success: boolean; fallbackProjectId: string } }>(`/projects/${id}`);
  return data.data;
}

export async function leaveProject(id: string) {
  const { data } = await api.post<{ data: { success: boolean } }>(`/projects/${id}/leave`);
  return data.data;
}

export async function setDefaultProject(id: string) {
  const { data } = await api.patch<{ data: Project }>(`/projects/${id}/default`);
  return data.data;
}

export async function getAccessibleProjects() {
  const { data } = await api.get<{ data: Project[] }>("/projects/accessible");
  return data.data;
}

export async function getProjectMembers(projectId: string) {
  const { data } = await api.get<{ data: ProjectMember[] }>(`/projects/${projectId}/members`);
  return data.data;
}

export async function inviteProjectMember(projectId: string, identifier: string) {
  const { data } = await api.post<{ data: ProjectInvitation }>(`/projects/${projectId}/invitations`, { identifier });
  return data.data;
}

export async function createProjectInviteLink(projectId: string) {
  const { data } = await api.post<{ data: { id: string; token: string; createdAt: string } }>(`/projects/${projectId}/invite-links`);
  return data.data;
}

export async function getProjectInvitePreview(token: string) {
  const { data } = await api.get<{ data: ProjectInvitePreview }>(`/projects/invite-links/${encodeURIComponent(token)}`);
  return data.data;
}

export async function acceptProjectInviteLink(token: string) {
  const { data } = await api.post<{ data: { success: boolean; projectId: string; alreadyMember: boolean } }>(`/projects/invite-links/${encodeURIComponent(token)}/accept`);
  return data.data;
}

export async function getPendingInvitations() {
  const { data } = await api.get<{ data: ProjectInvitation[] }>("/projects/invitations/pending");
  return data.data;
}

export async function getProjectInvitations(projectId: string) {
  const { data } = await api.get<{ data: ProjectInvitation[] }>(`/projects/${projectId}/invitations`);
  return data.data;
}

export async function cancelInvitation(invitationId: string) {
  const { data } = await api.delete<{ data: { success: boolean } }>(`/projects/invitations/${invitationId}`);
  return data.data;
}

export async function acceptInvitation(invitationId: string) {
  const { data } = await api.post<{ data: { success: boolean } }>(`/projects/invitations/${invitationId}/accept`);
  return data.data;
}

export async function declineInvitation(invitationId: string) {
  const { data } = await api.post<{ data: { success: boolean } }>(`/projects/invitations/${invitationId}/decline`);
  return data.data;
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const { data } = await api.delete<{ data: ProjectMember }>(`/projects/${projectId}/members/${memberId}`);
  return data.data;
}

export async function updateProjectMemberRole(projectId: string, memberId: string, role: ProjectRole) {
  const { data } = await api.patch<{ data: ProjectMember }>(`/projects/${projectId}/members/${memberId}/role`, { role });
  return data.data;
}

export async function updateProfile(payload: { name?: string; username?: string | null }) {
  const { data } = await api.patch<{ data: User }>("/user/profile", payload);
  return data.data;
}

export async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ data: User }>("/user/avatar", formData);
  return data.data;
}

export async function removeAvatar() {
  const { data } = await api.delete<{ data: User }>("/user/avatar");
  return data.data;
}
