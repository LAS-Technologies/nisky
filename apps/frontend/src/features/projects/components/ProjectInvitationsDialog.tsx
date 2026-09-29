"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAccessibleProjects, useInvitationMutations, usePendingInvitations, useProjectMemberMutations } from "../hooks/useProjects";
import { useAuth } from "@/context/AuthProvider";
import type { Project } from "@/types/entities";
import "./projects.css";

export function ProjectInvitationsDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project?: Project }) {
  const { user } = useAuth();
  const projects = useAccessibleProjects();
  const owned = (projects.data ?? []).filter(p => p.userId === user?.id && !p.isDefault);
  const [tab, setTab] = useState<"received" | "invite">(project ? "invite" : "received");
  const [projectId, setProjectId] = useState(project?.id ?? "");
  const [identifier, setIdentifier] = useState("");
  const received = usePendingInvitations();
  const replies = useInvitationMutations();
  const members = useProjectMemberMutations(projectId);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !projectId || members.invite.isPending) return;
    try { await members.invite.mutateAsync(identifier.trim()); setIdentifier(""); toast.success("¡Invitación enviada!"); onOpenChange(false); }
    catch { toast.error("No pudimos enviar la invitación. Revisa los datos e inténtalo de nuevo."); }
  };
  const reply = async (id: string, accept: boolean) => {
    try { await (accept ? replies.accept : replies.decline).mutateAsync(id); toast.success(accept ? "¡Invitación aceptada!" : "Invitación rechazada"); }
    catch { toast.error("No pudimos responder a la invitación."); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="project-dialog project-invitations-dialog sm:max-w-[720px]" overlayClassName="bg-[#0f1f33]/24 supports-backdrop-filter:backdrop-blur-none">
    <DialogHeader className="text-left"><DialogTitle>Colabora a tu ritmo</DialogTitle><DialogDescription className="project-muted mt-4">Invita a alguien o revisa lo que compartieron contigo.</DialogDescription></DialogHeader>
    <div className="project-tabs"><button className="project-button" aria-pressed={tab === "received"} onClick={() => setTab("received")}>Recibidas</button><button className="project-button" aria-pressed={tab === "invite"} onClick={() => setTab("invite")}>Invitar</button></div>
    {tab === "received" ? <div className="project-stack">
      {received.isPending ? <p role="status">Cargando invitaciones…</p> : received.isError ? <button className="project-button" onClick={() => void received.refetch()}>Reintentar invitaciones</button> : !received.data?.length ? <p className="project-muted">No tienes invitaciones pendientes.</p> : received.data.map(inv => <article className="project-panel project-card" key={inv.id}><h2>{inv.project.name}</h2><p className="project-small my-4">{inv.invitedBy.name ?? inv.invitedBy.email} te ha invitado a colaborar en este proyecto.</p><div className="flex flex-wrap gap-3"><button className="project-button" data-primary="true" disabled={replies.accept.isPending || replies.decline.isPending} onClick={() => void reply(inv.id,true)}>Aceptar</button><button className="project-button" disabled={replies.accept.isPending || replies.decline.isPending} onClick={() => void reply(inv.id,false)}>Rechazar</button></div></article>)}
    </div> : <form className="project-stack" onSubmit={e => void send(e)}>
      {!project && <label>Proyecto<select className="project-input" required value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Selecciona un proyecto</option>{owned.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {project && <p className="project-tag">{project.name}</p>}
      <label>Invitar por email o usuario<input className="project-input" aria-label="Email o @usuario del nuevo miembro" placeholder="nombre@ejemplo.com o @usuario" required value={identifier} onChange={e => setIdentifier(e.target.value)} /></label>
      <div className="project-dialog-footer"><button type="button" className="project-button" onClick={() => onOpenChange(false)}>Cancelar</button><button className="project-button" data-primary="true" disabled={!projectId || !identifier.trim() || members.invite.isPending}>Enviar invitación</button></div>
    </form>}
  </DialogContent></Dialog>;
}
