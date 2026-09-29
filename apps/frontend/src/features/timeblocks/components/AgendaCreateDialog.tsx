"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "@/components/ui/official.css";
import { useProjectsQuery } from "@/features/projects/hooks/useProjects";
import { useActiveTasksQuery } from "@/features/tasks/hooks/useTasks";
import { useEventMutations } from "@/features/events/hooks/useEvents";
import { useTimeBlockMutations } from "../hooks/useTimeBlocks";
import { saveTaskSchedule } from "@/features/task-schedules/api/taskSchedules";
import { minToTime, timeToMin } from "../lib/time";
import type { CalendarEvent, TimeBlock } from "@/types/entities";

export function AgendaCreateDialog({ kind, slot, onClose, onCreated }: {
  kind: "event" | "block";
  slot: { date: string; startMin: number; endMin: number };
  onClose: () => void;
  onCreated: (created: { kind: "event"; event: CalendarEvent } | { kind: "block"; block: TimeBlock; date: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(slot.date);
  const [start, setStart] = useState(minToTime(slot.startMin));
  const [end, setEnd] = useState(minToTime(slot.endMin));
  const [allDay, setAllDay] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [location, setLocation] = useState("");
  const [repeat, setRepeat] = useState("");
  const [reminder, setReminder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const projects = useProjectsQuery();
  const tasks = useActiveTasksQuery({ projectId: projectId || undefined }, { enabled: kind === "block" });
  const events = useEventMutations();
  const blocks = useTimeBlockMutations();
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const startMin = timeToMin(start), endMin = timeToMin(end), day = new Date(date + "T12:00:00");
    if (!title.trim() || !date || (!allDay && endMin <= startMin)) { setError("Revisa el nombre, la fecha y la hora de finalización."); return; }
    setBusy(true); setError("");
    try {
      if (kind === "event") {
        const created = await events.createEvent.mutateAsync({ title: title.trim(), date, allDay, startMin: allDay ? undefined : startMin, endMin: allDay ? undefined : endMin, location: location.trim() || undefined, color: "#1e3a5f", recurrenceType: repeat ? repeat as "DAILY" | "WEEKLY" | "MONTHLY" : null, recurrenceInterval: 1, recurrenceDaysOfWeek: repeat === "WEEKLY" ? [day.getDay()] : [], recurrenceDayOfMonth: repeat === "MONTHLY" ? day.getDate() : null, remindBeforeMin: reminder });
        onCreated({ kind: "event", event: created });
      } else {
        const created = await blocks.create.mutateAsync({ name: title.trim(), projectId: projectId || null, date: repeat ? null : date, daysOfWeek: [day.getDay()], startMin, endMin, repeatEveryWeeks: 1, remindBeforeMin: reminder });
        if (taskId) {
          try { await saveTaskSchedule(taskId, { date, timeBlockId: created.id }); }
          catch { toast.warning("Bloque creado. No pudimos asignar la tarea; puedes hacerlo desde el detalle."); }
        }
        onCreated({ kind: "block", block: created, date });
      }
      toast.success(kind === "event" ? "Evento creado" : "Bloque creado");
    } catch (cause) { setError((cause as { message?: string })?.message ?? "No pudimos guardar. Inténtalo de nuevo."); setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="official-dialog" overlayClassName="bg-[#0f1f33]/24 supports-backdrop-filter:backdrop-blur-none" showCloseButton={false}>
      <DialogHeader><DialogTitle>{kind === "block" ? "Reserva un bloque" : "Nuevo evento"}</DialogTitle><DialogDescription>{kind === "block" ? "Protege un espacio para concentrarte." : "Un compromiso con su propio espacio."}</DialogDescription></DialogHeader>
      <form onSubmit={event => void save(event)}><fieldset disabled={busy} className="official-form">
        <label>{kind === "block" ? "Nombre" : "Título"}<input className="field" autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)}/></label>
        {kind === "block" && <label>Proyecto<select aria-label="Proyecto" className="field" value={projectId} onChange={e => { setProjectId(e.target.value); setTaskId(""); }}><option value="">Sin proyecto</option>{projects.data?.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
        <div className="official-form-grid">
          <label>Fecha<input className="field" type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
          {kind === "event" ? <label>Todo el día<select aria-label="Todo el día" className="field" value={allDay ? "yes" : "no"} onChange={e => setAllDay(e.target.value === "yes")}><option value="no">Desactivado</option><option value="yes">Activado</option></select></label> : <label>Repetición<select aria-label="Repetición" className="field" value={repeat} onChange={e => setRepeat(e.target.value)}><option value="">Solo este día</option><option value="WEEKLY">Cada semana</option></select></label>}
          {!allDay && <><label>Desde<input className="field" type="time" required value={start} onChange={e => setStart(e.target.value)}/></label><label>Hasta<input className="field" type="time" required value={end} onChange={e => setEnd(e.target.value)}/></label></>}
        </div>
        {kind === "event" && <label>Lugar o enlace<input className="field" value={location} onChange={e => setLocation(e.target.value)} maxLength={500} placeholder="Sala de reuniones / enlace de videollamada"/></label>}
        <div className="official-form-grid">
          {kind === "event" && <label>Repetir<select aria-label="Repetir" className="field" value={repeat} onChange={e => setRepeat(e.target.value)}><option value="">No repetir</option><option value="DAILY">Cada día</option><option value="WEEKLY">Cada semana</option><option value="MONTHLY">Cada mes</option></select></label>}
          <label>Recordatorio<select aria-label="Recordatorio" className="field" value={reminder} onChange={e => setReminder(Number(e.target.value))}><option value={0}>Sin aviso previo</option><option value={10}>10 minutos antes</option><option value={15}>15 minutos antes</option><option value={60}>1 hora antes</option></select></label>
        </div>
        {kind === "block" && <label>Tarea del bloque<select aria-label="Tarea del bloque" className="field" value={taskId} onChange={e => setTaskId(e.target.value)}><option value="">Asignar después</option>{tasks.data?.data.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
        {error && <p role="alert" className="text-error">{error}</p>}
        <div className="official-form-footer"><button type="button" className="official-button" onClick={onClose}>Cancelar</button><button className="official-button" data-primary type="submit">{busy ? "Guardando…" : kind === "block" ? "Crear bloque" : "Guardar evento"}</button></div>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}
