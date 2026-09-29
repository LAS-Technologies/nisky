"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { AlarmClock, Bell, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useReminderMutations, useRemindersQuery } from "@/features/reminders/hooks/useReminders";

function localDateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function RemindersContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const query = useRemindersQuery();
  const mutations = useReminderMutations();
  const [title, setTitle] = useState(() => searchParams.get("title") ?? "");
  const [body, setBody] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [triggerTime, setTriggerTime] = useState("");
  const [repeatType, setRepeatType] = useState<"" | "DAILY" | "WEEKLY" | "MONTHLY">("");

  const create = async () => {
    if (!title.trim() || !triggerDate || !triggerTime) {
      toast.error("Escribe un título y elige cuándo avisarte.");
      return;
    }
    const triggerAt = `${triggerDate}T${triggerTime}`;
    try {
      await mutations.create.mutateAsync({
        title: title.trim(),
        body: body.trim() || undefined,
        triggerAt: new Date(triggerAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(repeatType ? { repeatType, repeatInterval: 1, repeatDaysOfWeek: repeatType === "WEEKLY" ? [new Date(triggerAt).getDay()] : [] } : {}),
        payload: taskId ? { type: "TASK_DUE", taskId } : { type: "CUSTOM" },
      });
      setTitle("");
      setBody("");
      setTriggerDate("");
      setTriggerTime("");
      setRepeatType("");
      toast.success("¡Recordatorio creado!");
    } catch {
      toast.error("Ups, no pudimos crear el recordatorio. Inténtalo de nuevo.");
    }
  };

  const remove = async (id: string) => {
    try {
      await mutations.remove.mutateAsync(id);
      toast.success("Recordatorio eliminado");
    } catch {
      toast.error("Ups, no pudimos eliminar el recordatorio. Inténtalo de nuevo.");
    }
  };

  return (
    <OfficialPage>
      <OfficialHeader eyebrow="RECORDATORIOS" title="Que no se te escape" description="Un pequeño aviso, justo cuando lo necesitas."/>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
         <section className="official-panel">
          <div className="flex items-center gap-2"><Bell className="text-primary" size={18} /><h2 className="font-headline-xs text-headline-xs">Nuevo recordatorio</h2></div>
          <div className="mt-4 space-y-3">
            <label className="block"><span className="font-label-caps text-label-caps text-on-surface-variant">QUÉ RECORDAR</span><input className="field mt-1" onChange={(event) => setTitle(event.target.value)} placeholder="Ej: llamar al médico" value={title} /></label>
            <label className="block"><span className="font-label-caps text-label-caps text-on-surface-variant">DETALLE (OPCIONAL)</span><textarea className="field mt-1 min-h-20 resize-y py-2" onChange={(event) => setBody(event.target.value)} placeholder="Añade un poco de contexto" value={body} /></label>
            <label className="block"><span className="font-label-caps text-label-caps text-on-surface-variant">FECHA</span><input className="field mt-1" onChange={(event) => setTriggerDate(event.target.value)} type="date" value={triggerDate} /></label>
            <label className="block"><span className="font-label-caps text-label-caps text-on-surface-variant">HORA</span><input className="field mt-1" onChange={(event) => setTriggerTime(event.target.value)} type="time" value={triggerTime} /></label>
            <label className="block"><span className="font-label-caps text-label-caps text-on-surface-variant">REPETIR</span><select className="field mt-1" onChange={(event) => setRepeatType(event.target.value as typeof repeatType)} value={repeatType}><option value="">No repetir</option><option value="DAILY">Cada día</option><option value="WEEKLY">Cada semana</option><option value="MONTHLY">Cada mes</option></select></label>
             <button className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary hover:bg-primary/90 disabled:opacity-50" disabled={mutations.create.isPending} onClick={() => void create()} type="button"><AlarmClock size={15} /> Crear recordatorio</button>
             <p className="font-body-sm text-body-sm text-on-surface-variant">Recibirás un aviso según tu configuración de notificaciones.</p>
          </div>
        </section>
         <section className="official-panel">
           <h2 className="font-headline-xs text-headline-xs">Próximos avisos</h2>
           {query.isLoading ? <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">Cargando recordatorios...</p> : query.isError ? <div className="mt-4"><p className="font-body-sm text-body-sm text-error">Ups, no pudimos cargar tus recordatorios.</p><button className="mt-2 font-label-md text-label-md text-primary underline" onClick={() => void query.refetch()} type="button">Reintentar</button></div> : query.data?.length === 0 ? <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">Todavía no tienes recordatorios.</p> : <div className="mt-4 divide-y divide-outline-variant border-y border-outline-variant">{query.data?.map((reminder) => <div className="flex items-start justify-between gap-3 py-4" key={reminder.id}><div className="min-w-0"><p className="font-body-md text-body-md">{reminder.title}</p>{reminder.body && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{reminder.body}</p>}<p className="mt-2 font-data-mono text-data-mono text-xs text-primary">{localDateTime(reminder.triggerAt)}{reminder.repeatType ? ` · ${reminder.repeatType === "DAILY" ? "Cada día" : reminder.repeatType === "WEEKLY" ? "Cada semana" : "Cada mes"}` : ""}</p></div><button aria-label={`Eliminar ${reminder.title}`} className="shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-error-container hover:text-error" onClick={() => void remove(reminder.id)} type="button"><Trash2 size={16} /></button></div>)}</div>}
           <Link className="official-button mt-5" href="/settings?tab=notifications">Configurar notificaciones</Link>
         </section>
      </div>
    </OfficialPage>
  );
}

export default function RemindersPage() {
  return <Suspense fallback={<div className="flex h-full items-center justify-center font-body-sm text-body-sm text-on-surface-variant">Cargando recordatorios...</div>}><RemindersContent /></Suspense>;
}
