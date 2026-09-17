"use client";

import { AtSign, Ban, Check, Copy, Link2, LogOut, Mail, ShieldCheck, UserMinus, UserRoundPlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuth } from "@/context/AuthProvider";
import { cn } from "@/lib/utils";
import type { Project, ProjectInviteLink } from "@/types/entities";
import { useLeaveProjectMutation, useProjectInviteLinks, useProjectInvitations, useProjectMemberMutations, useProjectMembers } from "../hooks/useProjects";

function MembersSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2">
      {[0, 1, 2].map((row) => (
        <div className="flex items-center gap-3 px-2 py-2.5" key={row}>
          <span className="h-8 w-8 shrink-0 animate-pulse rounded-full border border-outline-variant bg-surface-container-high" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-2.5 w-1/3 animate-pulse rounded-sm bg-surface-container-high" />
            <span className="block h-2.5 w-1/2 animate-pulse rounded-sm bg-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MembersPanel({ project }: { project: Project }) {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.id === project.userId;
  const canManageMembers = isOwner && !project.isDefault;
  const membersQuery = useProjectMembers(project.id);
  const invitationsQuery = useProjectInvitations(project.id);
  const inviteLinksQuery = useProjectInviteLinks(canManageMembers ? project.id : null);
  const mutations = useProjectMemberMutations(project.id);
  const leaveMutation = useLeaveProjectMutation();
  const [email, setEmail] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [confirmTransferId, setConfirmTransferId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmCancelInvitationId, setConfirmCancelInvitationId] = useState<string | null>(null);
  const [confirmRevokeInviteLinkId, setConfirmRevokeInviteLinkId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const inviteOrigin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const members = membersQuery.data ?? [];
  const pendingInvitations = invitationsQuery.data ?? [];
  const inviteLinks = inviteLinksQuery.data ?? [];
  const activeInviteLinks = inviteLinks.filter((link) => !link.revokedAt);
  const transferTarget = members.find((member) => member.id === confirmTransferId) ?? null;
  const removeTarget = members.find((member) => member.id === confirmRemoveId) ?? null;
  const cancelTarget = pendingInvitations.find((invitation) => invitation.id === confirmCancelInvitationId) ?? null;
  const revokeTarget = inviteLinks.find((link) => link.id === confirmRevokeInviteLinkId) ?? null;

  const invite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      await mutations.invite.mutateAsync(trimmed);
      setEmail("");
      toast.success("¡Invitación enviada!");
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos enviar la invitación.");
    }
  };

  const createInviteLink = async () => {
    try {
      const result = await mutations.createInviteLink.mutateAsync();
      const url = `${window.location.origin}/invite/${encodeURIComponent(result.token)}`;
      await navigator.clipboard?.writeText(url);
      setCopiedLinkId(result.id);
      toast.success("Enlace creado y copiado");
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos crear el enlace.");
    }
  };

  const copyInviteLink = async (link: ProjectInviteLink) => {
    if (!link.token) {
      toast.error("Este enlace fue creado con una versión anterior. Crea uno nuevo para poder copiarlo.");
      return;
    }
    const url = `${window.location.origin}/invite/${encodeURIComponent(link.token)}`;
    await navigator.clipboard?.writeText(url);
    setCopiedLinkId(link.id);
    toast.success("Enlace copiado");
  };

  const revokeInviteLink = async (linkId: string) => {
    try {
      await mutations.revokeInviteLink.mutateAsync({ linkId });
      setConfirmRevokeInviteLinkId(null);
      setCopiedLinkId(null);
      toast.success("Enlace revocado");
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos revocar el enlace.");
    }
  };

  const remove = async (memberId: string) => {
    try {
      await mutations.remove.mutateAsync(memberId);
      setConfirmRemoveId(null);
      toast.success("Miembro eliminado");
    } catch {
      toast.error("Ups, no pudimos eliminar al miembro.");
    }
  };

  const makeOwner = async (memberId: string) => {
    try {
      await mutations.updateRole.mutateAsync({ memberId, role: "OWNER" });
      setConfirmTransferId(null);
      toast.success("¡Se transfirió la propiedad del proyecto!");
    } catch {
      toast.error("Ups, no pudimos cambiar el rol.");
    }
  };

  const cancelPendingInvitation = async (invitationId: string) => {
    try {
      await mutations.cancel.mutateAsync(invitationId);
      setConfirmCancelInvitationId(null);
      toast.success("Invitación cancelada");
    } catch {
      toast.error("Ups, no pudimos cancelar la invitación.");
    }
  };

  const leave = async () => {
    try {
      await leaveMutation.mutateAsync(project.id);
      setConfirmLeave(false);
      toast.success("Te saliste del proyecto");
      router.push("/projects");
    } catch (error) {
      setConfirmLeave(false);
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos salir del proyecto.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-label-caps text-label-caps text-on-surface-variant">MIEMBROS</p>
        {!membersQuery.isLoading && members.length > 0 && (
          <span className="font-data-mono text-data-mono text-[11px] text-on-surface-variant">{members.length}</span>
        )}
      </div>

      {membersQuery.isLoading ? (
        <MembersSkeleton />
      ) : (
        <div className="divide-y divide-outline-variant">
          {members.map((member) => {
            const isSelf = member.userId === user?.id;
            const canManage = isOwner && !isSelf;
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5 -mx-2 hover:bg-surface-container-low" key={member.id}>
                <Avatar avatarUrl={member.user.avatarUrl} email={member.user.email} name={member.user.name} size="md" />
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-body-sm text-body-sm text-on-surface">
                    {member.user.name ?? member.user.email}
                    {member.user.username && <span className="ml-1 font-data-mono text-data-mono text-xs text-on-surface-variant">@{member.user.username}</span>}
                    {isSelf && <span className="ml-1 font-label-caps text-[10px] uppercase tracking-wide text-on-surface-variant">· tú</span>}
                  </span>
                  <span className="block truncate font-data-mono text-data-mono text-[11px] text-on-surface-variant">
                    {member.user.email}
                  </span>
                </span>

                <span
                  className={cn(
                     "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 font-label-caps text-[11px] uppercase tracking-wide",
                    member.role === "OWNER"
                      ? "border-primary/25 bg-primary-fixed/50 text-primary"
                      : "border-outline-variant bg-surface-container-high text-on-surface-variant",
                  )}
                >
                  {member.role === "OWNER" ? "Dueño" : "Miembro"}
                </span>

                {canManage && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {canManageMembers && member.role === "MEMBER" && (
                      <button
                        aria-label={`Hacer dueño a ${member.user.name ?? member.user.email}`}
                         className="flex h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                        onClick={() => setConfirmTransferId(member.id)}
                        title="Transferir propiedad"
                        type="button"
                      >
                        <ShieldCheck size={15} />
                        <span className="hidden sm:inline">Transferir</span>
                      </button>
                    )}
                    {canManageMembers && <button
                      aria-label={`Eliminar a ${member.user.name ?? member.user.email}`}
                       className="flex h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-on-surface-variant hover:border-error/50 hover:bg-surface-container-high hover:text-error"
                      onClick={() => setConfirmRemoveId(member.id)}
                      title="Eliminar miembro"
                      type="button"
                    >
                      <UserMinus size={15} />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManageMembers && pendingInvitations.length > 0 && (
        <div className="pt-1">
          <p className="flex items-center gap-1.5 py-1 font-label-caps text-label-caps text-on-surface-variant">
            <UserRoundPlus size={13} />
            INVITACIONES PENDIENTES ({pendingInvitations.length})
          </p>
          <div className="divide-y divide-outline-variant">
            {pendingInvitations.map((invitation) => (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5 -mx-2 hover:bg-surface-container-low" key={invitation.id}>
                <Avatar
                  avatarUrl={invitation.invitee?.avatarUrl ?? null}
                  email={invitation.email ?? "Invitación"}
                  name={invitation.invitee?.name ?? null}
                  size="md"
                />
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-body-sm text-body-sm text-on-surface">
                     {invitation.invitee?.name ?? invitation.email ?? "Invitación por enlace"}
                    {invitation.invitee?.username && (
                      <span className="ml-1 font-data-mono text-data-mono text-xs text-on-surface-variant">@{invitation.invitee.username}</span>
                    )}
                  </span>
                   <span className="block truncate font-data-mono text-data-mono text-[11px] text-on-surface-variant">{invitation.email ?? "Enlace de invitación"}</span>
                </span>
                 <span className="inline-flex shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-high px-1.5 py-0.5 font-label-caps text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Pendiente
                </span>
                <button
                  aria-label={`Cancelar invitación a ${invitation.invitee?.name ?? invitation.email ?? "invitación"}`}
                   className="flex h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-on-surface-variant hover:border-error/50 hover:bg-surface-container-high hover:text-error"
                  onClick={() => setConfirmCancelInvitationId(invitation.id)}
                  title="Cancelar invitación"
                  type="button"
                >
                  <X size={15} />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManageMembers ? (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <div className="space-y-2">
            <p className="font-label-caps text-label-caps text-on-surface-variant">INVITAR A UNA PERSONA</p>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <AtSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  aria-label="Email o @usuario del nuevo miembro"
                  className="field h-9 w-full pl-8"
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void invite();
                  }}
                  placeholder="email@ejemplo.com o @usuario"
                  type="text"
                  value={email}
                />
              </div>
              <button
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-primary hover:bg-surface-container-high disabled:opacity-50"
                disabled={!email.trim()}
                onClick={() => void invite()}
                type="button"
              >
                <Mail size={15} /> Invitar
              </button>
            </div>
          </div>

          <div aria-label="O crear un enlace de invitación" className="flex items-center gap-3" role="separator">
            <span aria-hidden="true" className="h-px flex-1 bg-outline-variant" />
            <span className="font-label-caps text-label-caps text-on-surface-variant">O</span>
            <span aria-hidden="true" className="h-px flex-1 bg-outline-variant" />
          </div>

          <div className="space-y-2">
            <p className="font-label-caps text-label-caps text-on-surface-variant">INVITAR CON ENLACE</p>
            <button
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm font-medium text-primary hover:bg-surface-container-high disabled:opacity-50"
              disabled={mutations.createInviteLink.isPending}
              onClick={() => void createInviteLink()}
              type="button"
            >
              <Link2 size={15} /> {mutations.createInviteLink.isPending ? "Creando enlace..." : "Crear enlace de invitación"}
            </button>
          </div>

          {inviteLinksQuery.isLoading ? (
            <p className="font-body-xs text-body-xs text-on-surface-variant">Cargando enlaces activos...</p>
          ) : activeInviteLinks.length > 0 && (
            <div className="space-y-2">
              <p className="font-label-caps text-label-caps text-on-surface-variant">ENLACES ACTIVOS ({activeInviteLinks.length})</p>
              <div className="space-y-2">
                {activeInviteLinks.map((link) => (
                  <div className="rounded-md border border-primary/20 bg-primary-fixed/30 p-2.5" key={link.id}>
                    {link.token ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input aria-label="Enlace de invitación" className="field h-9 min-w-0 flex-1 text-xs" readOnly value={`${inviteOrigin}/invite/${encodeURIComponent(link.token)}`} />
                        <div className="flex shrink-0 gap-2">
                          <button
                            aria-label="Copiar enlace de invitación"
                            className="flex h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-primary hover:bg-surface-container-high"
                            onClick={() => void copyInviteLink(link)}
                            type="button"
                          >
                            {copiedLinkId === link.id ? <Check size={15} /> : <Copy size={15} />}
                            <span>{copiedLinkId === link.id ? "Copiado" : "Copiar"}</span>
                          </button>
                          <button
                            aria-label="Revocar enlace de invitación"
                            className="flex h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-error hover:bg-surface-container-high"
                            onClick={() => setConfirmRevokeInviteLinkId(link.id)}
                            type="button"
                          >
                            <Ban size={15} /> <span>Revocar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 text-[12px] leading-4 text-on-surface-variant">Este enlace anterior ya no se puede mostrar. Crea uno nuevo para compartirlo.</p>
                        <button
                          aria-label="Revocar enlace anterior"
                          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 font-body-sm text-body-sm text-error hover:bg-surface-container-high"
                          onClick={() => setConfirmRevokeInviteLinkId(link.id)}
                          type="button"
                        >
                          <Ban size={15} /> <span className="hidden sm:inline">Revocar</span>
                        </button>
                      </div>
                    )}
                    <p className="mt-1.5 font-data-mono text-data-mono text-[10px] text-on-surface-variant">Creado el {new Date(link.createdAt).toLocaleDateString("es-DO")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : project.isDefault ? <p className="border-t border-outline-variant pt-3 font-body-sm text-body-sm text-on-surface-variant">Este es tu espacio personal; no tiene miembros compartidos.</p> : null}

      {!isOwner && (
        <div className="border-t border-outline-variant pt-3">
          <button
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-outline-variant px-3 font-body-sm text-body-sm text-on-surface-variant hover:border-error/50 hover:bg-surface-container-high hover:text-error"
            onClick={() => setConfirmLeave(true)}
            type="button"
          >
            <LogOut size={15} /> Salirme del proyecto
          </button>
        </div>
      )}

      {confirmLeave && (
        <ConfirmModal
          confirmLabel="Salirme"
          danger
          loading={leaveMutation.isPending}
          message={
            <>
              ¿Salirte de <strong>{project.name}</strong>? Perderás el acceso al proyecto y a sus tareas y comentarios. El dueño podrá volver a invitarte en cualquier momento.
            </>
          }
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => void leave()}
          title="¿Salir del proyecto?"
        />
      )}

      {confirmRemoveId && removeTarget && (
        <ConfirmModal
          confirmLabel="Eliminar"
          danger
          loading={mutations.remove.isPending}
          message={
            <>
              ¿Eliminar a <strong>{removeTarget.user.name ?? removeTarget.user.email}</strong> de <strong>{project.name}</strong>? Perderá el acceso al proyecto y a sus tareas y comentarios. Podrás volver a invitarlo en cualquier momento.
            </>
          }
          onClose={() => setConfirmRemoveId(null)}
          onConfirm={() => void remove(removeTarget.id)}
          title="¿Eliminar miembro?"
        />
      )}

      {confirmTransferId && transferTarget && (
        <ConfirmModal
          confirmLabel="Transferir"
          loading={mutations.updateRole.isPending}
          message={
            <>
              ¿Transferir la propiedad de <strong>{project.name}</strong> a <strong>{transferTarget.user.name ?? transferTarget.user.email}</strong>? Perderás el control del proyecto: quedarás como miembro y el nuevo dueño podrá expulsarte o eliminar el proyecto.
            </>
          }
          onClose={() => setConfirmTransferId(null)}
          onConfirm={() => void makeOwner(transferTarget.id)}
          title="¿Transferir propiedad?"
        />
      )}

      {confirmCancelInvitationId && cancelTarget && (
        <ConfirmModal
          confirmLabel="Cancelar invitación"
          danger
          loading={mutations.cancel.isPending}
          message={
            <>
              ¿Cancelar la invitación a <strong>{cancelTarget.invitee?.name ?? cancelTarget.email}</strong> para <strong>{project.name}</strong>? Podrás volver a invitarlo en cualquier momento.
            </>
          }
          onClose={() => setConfirmCancelInvitationId(null)}
          onConfirm={() => void cancelPendingInvitation(cancelTarget.id)}
          title="¿Cancelar invitación?"
        />
      )}

      {confirmRevokeInviteLinkId && revokeTarget && (
        <ConfirmModal
          confirmLabel="Revocar enlace"
          danger
          loading={mutations.revokeInviteLink.isPending}
          message={<>Cualquier persona que tenga este enlace dejará de poder unirse a <strong>{project.name}</strong>. Podrás crear otro cuando quieras.</>}
          onClose={() => setConfirmRevokeInviteLinkId(null)}
          onConfirm={() => void revokeInviteLink(revokeTarget.id)}
          title="¿Revocar enlace de invitación?"
        />
      )}
    </div>
  );
}
