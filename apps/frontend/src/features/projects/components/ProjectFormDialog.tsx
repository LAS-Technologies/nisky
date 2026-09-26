"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import type { CreateProjectPayload } from "../api/projects";
import type { Project } from "@/types/entities";
import "./projects.css";

export function ProjectFormDialog({ project, onClose, onSave }: { project?: Project; onClose: () => void; onSave: (payload: CreateProjectPayload) => Promise<unknown> }) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [targetDate, setTargetDate] = useState(project?.targetDate?.slice(0,10) ?? "");
  const [hours, setHours] = useState(project?.weeklyTargetMinutes ? String(Math.floor(project.weeklyTargetMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(project?.weeklyTargetMinutes ? String(project.weeklyTargetMinutes % 60) : "");
  const [color, setColor] = useState(project?.color ?? "#1e3a5f");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const weeklyTargetMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
      await onSave({ name: name.trim(), description: description.trim() || null, targetDate: targetDate || null, color, weeklyTargetMinutes: weeklyTargetMinutes || null });
      toast.success(project ? "Proyecto actualizado" : "¡Proyecto creado!");
      onClose();
    } catch { toast.error("No pudimos guardar el proyecto. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="project-dialog sm:max-w-[640px]" overlayClassName="bg-[#0f1f33]/24 supports-backdrop-filter:backdrop-blur-none" showCloseButton={false}>
      <DialogHeader className="text-left">
        <div className="flex items-center justify-between gap-4"><DialogTitle>{project ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle><DialogClose asChild><button className="project-button" disabled={busy} aria-label="Cerrar">×</button></DialogClose></div>
        <DialogDescription className="project-muted mt-4">Dale un lugar a tu próximo objetivo.</DialogDescription>
      </DialogHeader>
      <form className="project-stack" onSubmit={event => void submit(event)}>
        <label>Nombre del proyecto<input autoFocus className="project-input" required maxLength={100} disabled={project?.isDefault} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Descripción<textarea aria-label="Descripción" className="project-input" maxLength={2000} placeholder="Qué quieres conseguir y por qué importa…" value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="project-dialog-fields">
          <label>Fecha objetivo<input className="project-input" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></label>
          <fieldset><legend className="project-small mb-2">Meta semanal</legend><div className="flex items-center gap-2"><input className="project-input min-w-0" aria-label="Horas de meta semanal" type="number" min={0} max={168} value={hours} onChange={e => setHours(e.target.value)} placeholder="0" /><span>h</span><input className="project-input min-w-0" aria-label="Minutos de meta semanal" type="number" min={0} max={59} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="0" /><span>min</span></div></fieldset>
        </div>
        <div><p className="project-small mb-3">COLOR DEL PROYECTO</p><ColorPicker colors={["#1e3a5f", "#4a7c59", "#d97706", "#e11d48", ...(project && !["#1e3a5f", "#4a7c59", "#d97706", "#e11d48"].includes(project.color) ? [project.color] : [])]} value={color} onChange={setColor} /></div>
        <div className="project-dialog-footer"><DialogClose asChild><button className="project-button" disabled={busy} type="button">Cancelar</button></DialogClose><button className="project-button" data-primary="true" disabled={busy || !name.trim()} type="submit">{busy ? "Guardando…" : project ? "Guardar cambios" : "Crear proyecto"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
