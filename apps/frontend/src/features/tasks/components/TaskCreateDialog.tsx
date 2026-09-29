"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Project, Task } from "@/types/entities";
import type { TaskPayload } from "../api/tasks";
import { taskSchema } from "../schemas/task.schema";
import { useProjectMembers } from "@/features/projects/hooks/useProjects";
import { useReminderMutations } from "@/features/reminders/hooks/useReminders";
import { taskPriorityOptions, taskStatusOptions } from "./TaskFieldControls";

export function TaskCreateDialog({ projects, initial, onClose, onCreate }: {
  projects: Project[];
  initial: Partial<TaskPayload>;
  onClose: () => void;
  onCreate: (payload: TaskPayload) => Promise<Task>;
}) {
  const [draft, setDraft] = useState<TaskPayload>({ ...initial, title: initial.title ?? "", description: initial.description ?? "", status: initial.status ?? "PENDING", priority: initial.priority ?? "NORMAL", pomodoroEstimate: initial.pomodoroEstimate ?? 0 });
  const reminderMutations = useReminderMutations();
  const [repeat, setRepeat] = useState("");
  const [reminder, setReminder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const members = useProjectMembers(draft.projectId ?? null);
  const set = <K extends keyof TaskPayload>(key: K, value: TaskPayload[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const date = draft.dueDate ? new Date(draft.dueDate) : null;
    if ((repeat || reminder) && !date) { setError("Elige una fecha límite para repetir o recordar esta tarea."); return; }
    const triggerAt = date && reminder ? new Date(date.getTime() - Number(reminder) * 60000) : null;
    if (triggerAt && triggerAt.getTime() <= Date.now()) { setError("El recordatorio debe estar en el futuro."); return; }
    const parsed = taskSchema.safeParse({ ...draft, recurrence: repeat && date ? {
      repeatType: repeat, repeatInterval: 1,
      repeatDaysOfWeek: repeat === "WEEKLY" ? [date.getDay()] : [],
      repeatDayOfMonth: repeat === "MONTHLY" ? date.getDate() : undefined,
    } : undefined });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError("");
    try {
      const task = await onCreate(parsed.data);
      if (triggerAt) {
        try { await reminderMutations.create.mutateAsync({ title: task.title, triggerAt: triggerAt.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, payload: { type: "TASK_DUE", taskId: task.id } }); }
        catch { toast.warning("Tarea creada. No pudimos guardar el recordatorio; puedes añadirlo desde el detalle."); }
      }
      toast.success("¡Listo, tarea creada!");
    } catch { setError("No pudimos crear la tarea. Inténtalo de nuevo."); setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="tasks-dialog sm:max-w-[720px]" overlayClassName="bg-[#0f1f33]/24 supports-backdrop-filter:backdrop-blur-none" showCloseButton={false}>
      <DialogHeader className="text-left"><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Un próximo paso claro y alcanzable.</DialogDescription></DialogHeader>
      <form onSubmit={event => void submit(event)}>
        <fieldset disabled={busy} className="tasks-form">
          <label>Nombre de la tarea<input autoFocus required maxLength={200} className="tasks-input" placeholder="¿Qué quieres hacer?" value={draft.title} onChange={e => set("title", e.target.value)}/></label>
          <label>Descripción<textarea className="tasks-input" maxLength={2000} placeholder="Añade un poco de contexto…" value={draft.description ?? ""} onChange={e => set("description", e.target.value)}/></label>
          <div className="tasks-form-grid">
            <label>Proyecto<select className="tasks-input" value={draft.projectId ?? ""} onChange={e => setDraft(previous => ({ ...previous, projectId: e.target.value || undefined, assigneeId: null }))}><option value="">Sin proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Responsable<select className="tasks-input" value={draft.assigneeId ?? ""} onChange={e => set("assigneeId", e.target.value || null)} disabled={!draft.projectId || members.isLoading}><option value="">Sin asignar</option>{members.data?.map(m => <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>)}</select></label>
            <label>Prioridad<select className="tasks-input" value={draft.priority} onChange={e => set("priority", e.target.value as TaskPayload["priority"])}>{taskPriorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label>Fecha límite<input className="tasks-input" type="datetime-local" value={draft.dueDate ?? ""} onChange={e => set("dueDate", e.target.value)}/></label>
            <label>Estado<select className="tasks-input" value={draft.status} onChange={e => set("status", e.target.value as TaskPayload["status"])}>{taskStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label>Pomodoros estimados<input className="tasks-input" type="number" min={0} max={100} value={draft.pomodoroEstimate} onChange={e => set("pomodoroEstimate", Number(e.target.value))}/></label>
            <label>Repetir<select aria-label="Repetir" className="tasks-input" value={repeat} onChange={e => setRepeat(e.target.value)}><option value="">No repetir</option><option value="DAILY">Cada día</option><option value="WEEKLY">Cada semana</option><option value="MONTHLY">Cada mes</option></select></label>
            <label>Recordatorio<select aria-label="Recordatorio" className="tasks-input" value={reminder} onChange={e => setReminder(e.target.value)}><option value="">Sin recordatorio</option><option value="0">A la hora de vencimiento</option><option value="10">10 minutos antes</option><option value="60">1 hora antes</option><option value="1440">1 día antes</option></select></label>
          </div>
          {error && <p role="alert" className="text-error">{error}</p>}
          <div className="tasks-form-footer"><button className="tasks-button" type="button" onClick={onClose}>Cancelar</button><button className="tasks-button" data-primary type="submit">{busy ? "Creando…" : "Crear tarea"}</button></div>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>;
}
