"use client";

import Link from "next/link";
import { OfficialHeader } from "@/components/ui/OfficialPage";
import { AgendaCreateDialog } from "@/features/timeblocks/components/AgendaCreateDialog";
import "@/features/timeblocks/components/agenda.css";
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useProjectsQuery } from "@/features/projects/hooks/useProjects";
import { TimeBlockPreviewModal } from "@/features/timeblocks/components/TimeBlockPreviewModal";
import { TimeBlockWeekGrid } from "@/features/timeblocks/components/TimeBlockWeekGrid";
import { MobileAgenda } from "@/features/timeblocks/components/MobileAgenda";
import { AgendaEntryChooser, type AgendaEntryKind } from "@/features/timeblocks/components/AgendaEntryChooser";
import { AgendaDayTasksDialog } from "@/features/timeblocks/components/AgendaDayTasksDialog";
import { EventPreviewModal } from "@/features/events/components/EventPreviewModal";
import { useTasksQuery } from "@/features/tasks/hooks/useTasks";
import {
  useTimeBlockMutations,
  useTimeBlockSettingsMutation,
  useTimeBlockSettingsQuery,
  useTimeBlocksQuery,
  useWeekExceptionsQuery,
} from "@/features/timeblocks/hooks/useTimeBlocks";
import { useEventsQuery, useEventMutations } from "@/features/events/hooks/useEvents";
import { minToTime, parseDateOnly, timeToMin } from "@/features/timeblocks/lib/time";
import { findAvailableStartMin } from "@/features/timeblocks/lib/availability";
import { useIsMobile } from "@/hooks/useIsMobile";
import { localDateKey } from "@/lib/utils";
import type { CalendarEvent, TimeBlock } from "@/types/entities";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SlotPrefill = { dayOfWeek: number; startMin: number; endMin: number; date: string; oneOff?: boolean };
type EventMoveScope = "single" | "all";

function toISODateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function EventMoveModal({
  title,
  startTime,
  endTime,
  busy,
  onChangeStart,
  onChangeEnd,
  onCancel,
  onSave,
}: {
  title: string;
  startTime: string;
  endTime: string;
  busy: boolean;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  onCancel: () => void;
  onSave: (scope: EventMoveScope) => void;
}) {
  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="max-w-md rounded-lg border-outline-variant bg-surface shadow-cadence-3" showCloseButton={false}>
        <DialogHeader className="text-left">
          <DialogTitle className="font-headline-xs text-headline-xs normal-case tracking-normal">Mover «{title}»</DialogTitle>
          <DialogDescription className="font-body-md text-body-md text-on-surface-variant">
          Elige si el nuevo horario aplica a este día o a todas las ocurrencias del evento.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-label-md text-label-md text-on-surface-variant">Inicio</span>
            <input
              className="field mt-1"
              onChange={(e) => onChangeStart(e.target.value)}
              type="time"
              value={startTime}
            />
          </label>
          <label className="block">
            <span className="font-label-md text-label-md text-on-surface-variant">Fin</span>
            <input
              className="field mt-1"
              onChange={(e) => onChangeEnd(e.target.value)}
              type="time"
              value={endTime}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button className="min-h-11 rounded-md border border-outline-variant bg-surface px-4 py-2 font-body-md text-body-md text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-50" disabled={busy} type="button">Cancelar</button>
          </DialogClose>
          <button
            className="min-h-11 rounded-md border border-secondary px-4 py-2 font-body-md text-body-md text-secondary transition-colors hover:bg-secondary-container disabled:opacity-50"
            disabled={busy}
            onClick={() => onSave("single")}
            type="button"
          >
            Solo este día
          </button>
          <button
            className="min-h-11 rounded-md bg-primary px-4 py-2 font-body-md text-body-md text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={busy}
            onClick={() => onSave("all")}
            type="button"
          >
            Todas las ocurrencias
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResizeResolveModal({
  date,
  onException,
  onOriginal,
  onCancel,
  busy,
}: {
  date: string;
  onException: () => void;
  onOriginal: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="max-w-md rounded-lg border-outline-variant bg-surface shadow-cadence-3" showCloseButton={false}>
        <DialogHeader className="text-left">
          <DialogTitle className="font-headline-xs text-headline-xs normal-case tracking-normal">¿Aplicar cambio a un solo día?</DialogTitle>
          <DialogDescription className="font-body-md text-body-md text-on-surface-variant">
          Este bloque se repite varios días. Puedes moverlo solo el {date} o cambiar el horario original para siempre.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button className="min-h-11 rounded-md border border-outline-variant bg-surface px-4 py-2 font-body-md text-body-md text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-50" disabled={busy} type="button">Cancelar</button>
          </DialogClose>
          <button
            className="min-h-11 rounded-md border border-secondary px-4 py-2 font-body-md text-body-md text-secondary transition-colors hover:bg-secondary-container disabled:opacity-50"
            disabled={busy}
            onClick={onOriginal}
            type="button"
          >
            Cambiar original
          </button>
          <button
            className="min-h-11 rounded-md bg-primary px-4 py-2 font-body-md text-body-md text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={busy}
            onClick={onException}
            type="button"
          >
            Solo este día
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimeBlocksContent() {
  const query = useTimeBlocksQuery();
  const mutations = useTimeBlockMutations();
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];
  const settingsQuery = useTimeBlockSettingsQuery();
  const settingsMutation = useTimeBlockSettingsMutation();
  const settings = settingsQuery.data;
  const isMobile = useIsMobile(1023);
  const blocks = query.data ?? [];
  const [mobileDate, setMobileDate] = useState(() => new Date());
  const [mobileView, setMobileView] = useState<"day" | "week">("day");
  const [previewingBlock, setPreviewingBlock] = useState<TimeBlock | null>(null);
  const [previewBlockDate, setPreviewBlockDate] = useState<Date | null>(null);
  const [entryChooserOpen, setEntryChooserOpen] = useState(false);
  const [entrySlot, setEntrySlot] = useState<SlotPrefill | null>(null);
  const [previewingEvent, setPreviewingEvent] = useState<CalendarEvent | null>(null);
  const [dayTaskDate, setDayTaskDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatingKind, setCreatingKind] = useState<AgendaEntryKind | null>(null);
  const [resolveDraft, setResolveDraft] = useState<{
    block: TimeBlock;
    startMin: number;
    endMin: number;
    days: number[];
    draggedDate: string;
  } | null>(null);
  const [dayStartTime, setDayStartTime] = useState("06:00");
  const [dayEndTime, setDayEndTime] = useState("23:00");
  const settingsBusy = settingsMutation.isPending;

  const now = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = new Date(now);
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const weekStart = new Date(anchor);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const mobileWeekStart = new Date(mobileDate);
  mobileWeekStart.setHours(0, 0, 0, 0);
  const mobileDay = mobileWeekStart.getDay();
  mobileWeekStart.setDate(mobileWeekStart.getDate() - (mobileDay === 0 ? 6 : mobileDay - 1));
  const queryWeekStart = isMobile ? mobileWeekStart : weekStart;
  const queryWeekEnd = new Date(queryWeekStart);
  queryWeekEnd.setDate(queryWeekEnd.getDate() + 6);

  const from = toISODateString(queryWeekStart);
  const to = toISODateString(queryWeekEnd);
  
  const eventsQuery = useEventsQuery(from, to);
  const events = eventsQuery.data ?? [];
  const eventMutations = useEventMutations();
  const [eventMoveDraft, setEventMoveDraft] = useState<{ event: CalendarEvent; date: Date } | null>(null);
  const [eventMoveStart, setEventMoveStart] = useState("09:00");
  const [eventMoveEnd, setEventMoveEnd] = useState("10:00");
  const exceptionsQuery = useWeekExceptionsQuery(from, to);
  const exceptions = exceptionsQuery.data ?? [];
  const tasksQuery = useTasksQuery({
    dueFrom: from,
    dueTo: to,
    status: ["PENDING", "IN_PROGRESS", "COMPLETED"],
    sort: "dueDate",
    order: "asc",
    limit: 100,
  });
  const dueTasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data]);
  const dueTaskCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of dueTasks) {
      if (!task.dueDate) continue;
      const key = localDateKey(task.dueDate);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [dueTasks]);
  const dayTasks = useMemo(
    () => dayTaskDate ? dueTasks.filter((task) => task.dueDate && localDateKey(task.dueDate) === dayTaskDate) : [],
    [dayTaskDate, dueTasks],
  );

  const openSettings = () => {
    setDayStartTime(minToTime(settings?.dayStartMin ?? 6 * 60));
    setDayEndTime(minToTime(settings?.dayEndMin ?? 23 * 60));
    setSettingsOpen((open) => !open);
  };

  const saveDayRange = async () => {
    const dayStartMin = timeToMin(dayStartTime);
    const dayEndMin = timeToMin(dayEndTime);
    if (dayEndMin <= dayStartMin) {
      toast.error("El fin del día debe ser mayor al inicio.");
      return;
    }
    try {
      await settingsMutation.mutateAsync({ dayStartMin, dayEndMin });
      toast.success("Rango del día actualizado");
      setSettingsOpen(false);
    } catch {
      toast.error("Ups, no pudimos actualizar el rango del día.");
    }
  };

  const defaultAgendaSlot = (date = new Date()): SlotPrefill => {
    const now = new Date();
    const dateKey = toISODateString(date);
    const currentMin = dateKey === toISODateString(now) ? now.getHours() * 60 + now.getMinutes() : 9 * 60;
    const preferredStartMin = Math.min(Math.max(Math.ceil(currentMin / 15) * 15, 6 * 60), 22 * 60);
    const startMin = findAvailableStartMin({
      blocks,
      dateKey,
      dayOfWeek: date.getDay(),
      events,
      preferredStartMin,
    }) ?? preferredStartMin;
    return {
      dayOfWeek: date.getDay(),
      startMin,
      endMin: startMin + 60,
      date: dateKey,
    };
  };

  const openEntryChooser = (slot?: SlotPrefill) => {
    setEntrySlot(slot ?? defaultAgendaSlot());
    setEntryChooserOpen(true);
  };

  const selectAgendaEntry = (kind: AgendaEntryKind) => {
    setEntrySlot(entrySlot ?? defaultAgendaSlot());
    setEntryChooserOpen(false);
    setCreatingKind(kind);
  };

  const openBlockPreview = (block: TimeBlock, date?: Date) => {
    setPreviewingEvent(null);
    setPreviewingBlock(block);
    setPreviewBlockDate(date ?? null);
  };

  const resizeBlock = async (block: TimeBlock, startMin: number, endMin: number, days: number[], draggedDate?: string) => {
    const daysChanged =
      days.length !== block.daysOfWeek.length ||
      days.some((day, index) => day !== block.daysOfWeek[index]);

    const hasMoveException =
      !!draggedDate &&
      exceptions.some((exc) => {
        if (exc.blockId !== block.id || exc.action !== "move") return false;
        const d = parseDateOnly(exc.date);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return dayKey === draggedDate;
      });

    if (!daysChanged && hasMoveException) {
      try {
        await mutations.createException.mutateAsync({
          id: block.id,
          date: draggedDate,
          action: "move",
          startMin,
          endMin,
        });
        toast.success("Excepción actualizada para este día");
      } catch (err) {
        toast.error((err as { message?: string })?.message ?? "Ups, no pudimos actualizar la excepción.");
      }
      return;
    }

    if (startMin === block.startMin && endMin === block.endMin && !daysChanged) return;

    if (!daysChanged && draggedDate && (block.daysOfWeek.length > 1 || block.repeatEveryWeeks > 1)) {
      setResolveDraft({ block, startMin, endMin, days, draggedDate });
      return;
    }

    try {
      await mutations.update.mutateAsync({
        id: block.id,
        payload: { startMin, endMin, daysOfWeek: days },
      });
      toast.success("Bloque actualizado en la Agenda");
    } catch {
      toast.error("Ups, no pudimos ajustar el bloque. Inténtalo de nuevo.");
    }
  };

  const resolveAsException = async () => {
    if (!resolveDraft) return;
    const { block, startMin, endMin, draggedDate } = resolveDraft;
    try {
      await mutations.createException.mutateAsync({
        id: block.id,
        date: draggedDate,
        action: "move",
        startMin,
        endMin,
      });
      toast.success("Excepción guardada para este día");
      setResolveDraft(null);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Ups, no pudimos crear la excepción.");
    }
  };

  const resolveAsOriginal = async () => {
    if (!resolveDraft) return;
    const { block, startMin, endMin, days } = resolveDraft;
    try {
      await mutations.update.mutateAsync({
        id: block.id,
        payload: { startMin, endMin, daysOfWeek: days },
      });
      toast.success("Horario actualizado para todos los días");
    } catch {
      toast.error("Ups, no pudimos ajustar el bloque. Inténtalo de nuevo.");
    }
    setResolveDraft(null);
  };

  const openEventPreview = (event: CalendarEvent) => {
    setPreviewingBlock(null);
    setPreviewBlockDate(null);
    setPreviewingEvent(event);
  };

  const shiftMobileDate = (amount: number) => {
    setMobileDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount);
      return next;
    });
  };

  const openMobileCreate = () => {
    openEntryChooser(defaultAgendaSlot(mobileDate));
  };

  const skipPreviewedBlockDay = async (date: string) => {
    if (!previewingBlock) return;
    try {
      await mutations.createException.mutateAsync({
        id: previewingBlock.id,
        date,
        action: "skip",
      });
      toast.success("Bloque saltado ese día");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Ups, no pudimos saltar el bloque.");
      throw err;
    }
  };

  const handleEventAction = (event: CalendarEvent, date: Date, action: "skip" | "move") => {
    const dateStr = toISODateString(date);
    if (action === "skip") {
      eventMutations.createException
        .mutateAsync({ eventId: event.id, payload: { date: dateStr, action: "skip" } })
        .then(() => toast.success("Evento saltado ese día"))
        .catch((err) =>
          toast.error((err as { message?: string })?.message ?? "Ups, no pudimos saltar el evento."),
        );
      return;
    }
    setEventMoveStart(minToTime(event.startMin ?? 9 * 60));
    setEventMoveEnd(minToTime(event.endMin ?? 10 * 60));
    setEventMoveDraft({ event, date });
  };

  const handleEventMove = async (
    event: CalendarEvent,
    sourceDate: Date,
    targetDate: Date,
    startMin: number,
    endMin: number,
  ) => {
    if (event.recurrenceType) {
      setEventMoveStart(minToTime(startMin));
      setEventMoveEnd(minToTime(endMin));
      setEventMoveDraft({ event, date: sourceDate });
      return;
    }

    try {
      await eventMutations.updateEvent.mutateAsync({
        id: event.id,
        payload: {
          date: toISODateString(targetDate),
          startMin,
          endMin,
        },
      });
      toast.success("Evento movido");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Ups, no pudimos mover el evento.");
    }
  };

  const saveEventMove = async (scope: EventMoveScope) => {
    if (!eventMoveDraft) return;
    const startMin = timeToMin(eventMoveStart);
    const endMin = timeToMin(eventMoveEnd);
    if (endMin <= startMin) {
      toast.error("El fin debe ser mayor al inicio.");
      return;
    }
    try {
      if (scope === "all") {
        await eventMutations.updateEvent.mutateAsync({
          id: eventMoveDraft.event.id,
          payload: { startMin, endMin },
        });
        toast.success("Evento movido en todas las ocurrencias");
      } else {
        await eventMutations.createException.mutateAsync({
          eventId: eventMoveDraft.event.id,
          payload: { date: toISODateString(eventMoveDraft.date), action: "move", startMin, endMin },
        });
        toast.success("Evento movido ese día");
      }
      setEventMoveDraft(null);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Ups, no pudimos mover el evento.");
    }
  };

  return (
    <section className="official-page official-agenda">
      <div className="lg:hidden">
        <MobileAgenda
          blocks={blocks}
          dayEndMin={settings?.dayEndMin ?? 23 * 60}
          dayStartMin={settings?.dayStartMin ?? 6 * 60}
          events={events}
          exceptions={exceptions}
          onAdd={openMobileCreate}
           onBlockClick={openBlockPreview}
           onDateChange={setMobileDate}
           onDayTasksClick={(date) => setDayTaskDate(date)}
           onEventClick={openEventPreview}
           onNextDay={() => shiftMobileDate(1)}
          onPreviousDay={() => shiftMobileDate(-1)}
          onToday={() => setMobileDate(new Date())}
          onViewChange={setMobileView}
          projects={projects}
          selectedDate={mobileDate}
          dueTaskCountsByDate={dueTaskCountsByDate}
          view={mobileView}
          weekStart={mobileWeekStart}
        />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
      <OfficialHeader eyebrow="AGENDA" title="Tu semana, con espacio" description="Reserva tiempo para lo que importa." actions={<button className="official-button" data-primary onClick={() => openEntryChooser()}><Plus size={16}/>Añadir</button>}/>
      <div className="official-toolbar">
          <button className="official-button" onClick={() => setWeekOffset(0)}>Hoy</button>
          {weekOffset !== 0 && (
            <button
              className="min-h-11 rounded-md px-2.5 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-secondary sm:min-h-10"
              onClick={() => setWeekOffset(0)}
              title="Volver a la semana actual"
              type="button"
            >
              Volver a hoy
            </button>
          )}
          <div className="flex items-center overflow-hidden rounded-md border border-outline-variant bg-surface">
            <button
              aria-label="Semana anterior"
              className="flex h-11 w-11 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-secondary sm:h-10 sm:w-10"
              onClick={() => setWeekOffset((offset) => offset - 1)}
              title="Semana anterior"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="flex min-h-11 min-w-[9.5rem] items-center justify-center border-x border-outline-variant px-3 text-center font-data-mono text-data-mono text-xs text-on-surface-variant sm:min-h-10">
              {weekStart.getDate() < weekEnd.getDate()
                ? `${weekStart.getDate()}–${weekEnd.getDate()} ${weekEnd.toLocaleDateString("es", { month: "short" })}`
                : `${weekStart.toLocaleDateString("es", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("es", { day: "numeric", month: "short" })}`}
            </span>
            <button
              aria-label="Semana siguiente"
              className="flex h-11 w-11 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-secondary sm:h-10 sm:w-10"
              onClick={() => setWeekOffset((offset) => offset + 1)}
              title="Semana siguiente"
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            aria-label={`Configurar horario (${minToTime(settings?.dayStartMin ?? 6 * 60)} – ${minToTime(settings?.dayEndMin ?? 23 * 60)})`}
            className="flex min-h-11 items-center gap-2 rounded-md px-2.5 py-1.5 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-secondary"
            onClick={openSettings}
            type="button"
          >
            <SlidersHorizontal size={14} />
            <span>Horario</span>
          </button>
          <span className="official-button" aria-current="page">Semana</span>
          <Link className="official-button" href="/events">Eventos</Link>
      </div>

      {settingsOpen && (
        <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-5 shadow-cadence-1">
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            RANGO DEL DÍA
          </p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Define las horas visibles en tu horario semanal.
          </p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Inicio</span>
              <input
                className="field mt-1"
                onChange={(event) => setDayStartTime(event.target.value)}
                type="time"
                value={dayStartTime}
              />
            </label>
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Fin</span>
              <input
                className="field mt-1"
                onChange={(event) => setDayEndTime(event.target.value)}
                type="time"
                value={dayEndTime}
              />
            </label>
          </div>
          <button
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={settingsBusy}
            onClick={() => void saveDayRange()}
            type="button"
          >
            Guardar rango
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-cadence-1 lg:overflow-y-auto">
        <TimeBlockWeekGrid
          blocks={blocks}
          events={events}
          exceptions={exceptions}
          dayEndMin={settings?.dayEndMin ?? 23 * 60}
          dayStartMin={settings?.dayStartMin ?? 6 * 60}
          moveEnabled={!isMobile}
          onDayTasksClick={(date) => setDayTaskDate(date)}
           onBlockClick={openBlockPreview}
           onEventClick={openEventPreview}
           onEventMove={handleEventMove}
           onEventAction={handleEventAction}
          onResize={resizeBlock}
          onSlotClick={(dayOfWeek, startMin, date) => openEntryChooser({
            dayOfWeek,
            startMin,
            endMin: Math.min(startMin + 60, 24 * 60),
            date: toISODateString(date),
          })}
          projects={projects}
          dueTaskCountsByDate={dueTaskCountsByDate}
          weekStart={weekStart}
         />
      </div>
      </div>

      {previewingBlock && (
        <TimeBlockPreviewModal
          block={previewingBlock}
          key={previewingBlock.id}
          occurrenceDate={previewBlockDate ?? undefined}
            onClose={() => { setPreviewingBlock(null); setPreviewBlockDate(null); }}
            onSkipDay={skipPreviewedBlockDay}
            project={projects.find((project) => project.id === previewingBlock.projectId)}
          />
      )}

      {previewingEvent && (
        <EventPreviewModal
          event={previewingEvent}
          key={previewingEvent.id}
          onClose={() => setPreviewingEvent(null)}
        />
      )}

      {resolveDraft && (
        <ResizeResolveModal
          busy={mutations.createException.isPending || mutations.update.isPending}
          date={resolveDraft.draggedDate}
          onCancel={() => setResolveDraft(null)}
          onException={() => void resolveAsException()}
          onOriginal={() => void resolveAsOriginal()}
         />
       )}

      {creatingKind && <AgendaCreateDialog kind={creatingKind} slot={entrySlot ?? defaultAgendaSlot()} onClose={() => setCreatingKind(null)} onCreated={result => {
        setCreatingKind(null);
        if (result.kind === "event") { setPreviewingBlock(null); setPreviewingEvent(result.event); }
        else { setPreviewingEvent(null); setPreviewingBlock(result.block); setPreviewBlockDate(parseDateOnly(result.date)); }
      }}/>}
      {entryChooserOpen && (
        <AgendaEntryChooser
          onClose={() => setEntryChooserOpen(false)}
          onSelect={selectAgendaEntry}
        />
      )}

      {dayTaskDate && (
        <AgendaDayTasksDialog
          date={dayTaskDate}
          onClose={() => setDayTaskDate(null)}
          tasks={dayTasks}
        />
      )}

      {eventMoveDraft && (
        <EventMoveModal
          busy={eventMutations.createException.isPending || eventMutations.updateEvent.isPending}
          endTime={eventMoveEnd}
          onChangeEnd={setEventMoveEnd}
          onChangeStart={setEventMoveStart}
          onCancel={() => setEventMoveDraft(null)}
          onSave={(scope) => void saveEventMove(scope)}
          startTime={eventMoveStart}
          title={eventMoveDraft.event.title}
        />
      )}
    </section>
  );
}

export default function TimeBlocksPage() {
  return <TimeBlocksContent />;
}
