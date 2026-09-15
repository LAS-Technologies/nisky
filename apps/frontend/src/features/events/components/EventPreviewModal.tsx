"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CalendarX, ExternalLink, MapPin, Pencil, Repeat2, RotateCcw, Trash2, Video, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { CalendarEvent, EventRecurrenceType } from "@/types/entities";
import type { CalendarEventUpdatePayload } from "@/features/events/api/events";
import { useEventExceptionsQuery, useEventMutations } from "@/features/events/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ColorPicker, PROJECT_COLORS } from "@/components/ui/ColorPicker";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNestedRoot,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PreviewSheet } from "@/components/ui/PreviewSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/useIsMobile";
import { minToTime, parseDateOnly, timeToMin, toDateKey } from "@/features/timeblocks/lib/time";
import { cn } from "@/lib/utils";

const REMIND_OPTIONS = [
  { value: 0, label: "Sin aviso" },
  { value: 5, label: "5 min antes" },
  { value: 10, label: "10 min antes" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 día antes" },
  { value: 10080, label: "1 semana antes" },
] as const;

const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "No repetir" },
  { value: "DAILY", label: "Cada día" },
  { value: "WEEKLY", label: "Cada semana" },
  { value: "MONTHLY", label: "Cada mes" },
  { value: "YEARLY", label: "Cada año" },
] as const;

type EventDraftField = "title" | "schedule" | "location" | "color" | "recurrence" | "reminder";

function eventDate(value: string) {
  return parseDateOnly(value).toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function exceptionDate(value: string) {
  return parseDateOnly(value).toLocaleDateString("es-DO", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replaceAll(".", "");
}

function eventDuration(event: CalendarEvent) {
  if (event.allDay || event.startMin === null || event.endMin === null) return null;
  const duration = event.endMin - event.startMin;
  if (duration < 60) return `${duration} min`;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function reminderLabel(minutes: number) {
  if (minutes === 0) return "Sin aviso previo";
  if (minutes < 60) return `${minutes} min antes`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hora" : "horas"} antes`;
  return `${minutes} min antes`;
}

function reminderOptions(currentValue: number) {
  if (REMIND_OPTIONS.some((option) => option.value === currentValue)) return REMIND_OPTIONS;
  return [...REMIND_OPTIONS, { value: currentValue, label: reminderLabel(currentValue) }].sort((a, b) => a.value - b.value);
}

function externalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function resizeTitleInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
}

type EventScheduleDraft = {
  allDay: boolean;
  date: string;
  endTime: string;
  startTime: string;
};

function scheduleDraftFrom(event: CalendarEvent): EventScheduleDraft {
  return {
    allDay: event.allDay,
    date: event.date.slice(0, 10),
    endTime: event.endMin === null ? "10:00" : minToTime(event.endMin),
    startTime: event.startMin === null ? "09:00" : minToTime(event.startMin),
  };
}

function scheduleDraftLabel(draft: EventScheduleDraft) {
  return `${eventDate(draft.date)} · ${draft.allDay ? "Todo el día" : `De ${draft.startTime} a ${draft.endTime}`}`;
}

function DetailRow({ icon: Icon, children, divided = false }: { icon: LucideIcon; children: ReactNode; divided?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3", divided && "border-t border-outline-variant/70 pt-4")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/70 bg-surface-container-lowest text-on-surface-variant shadow-cadence-1">
        <Icon aria-hidden="true" size={18} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function EventScheduleEditor({
  draft,
  fullWidth = false,
  onCancel,
  onChange,
  onSave,
  pending,
}: {
  draft: EventScheduleDraft;
  fullWidth?: boolean;
  onCancel: () => void;
  onChange: (draft: EventScheduleDraft) => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <>
      <Calendar
        aria-label="Seleccionar fecha del evento"
        className={fullWidth ? "w-full" : "mx-auto"}
        classNames={
          fullWidth
            ? {
                month: "relative w-full space-y-4",
                month_grid: "w-full border-collapse",
                months: "flex w-full flex-col gap-4",
                day: "relative flex-1 p-0 text-center text-sm",
                day_button: "size-full min-h-9",
                weekday:
                  "h-8 flex-1 rounded-md text-center font-label-caps text-[10px] text-on-surface-variant",
                weekdays: "flex w-full",
                week: "mt-1 flex w-full",
              }
            : undefined
        }
        defaultMonth={parseDateOnly(draft.date)}
        mode="single"
        onSelect={(date) => {
          if (date) onChange({ ...draft, date: toDateKey(date) });
        }}
        selected={parseDateOnly(draft.date)}
      />
      <div className="border-t border-outline-variant p-3">
        <label className="flex min-h-11 items-center gap-2 font-body-sm text-body-sm text-on-surface">
          <input
            checked={draft.allDay}
            className="size-5 accent-tertiary"
            disabled={pending}
            onChange={(event) => onChange({ ...draft, allDay: event.target.checked })}
            type="checkbox"
          />
          Todo el día
        </label>
        {!draft.allDay && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="block" htmlFor="event-preview-start">Inicio</Label>
              <Input
                className="mt-1"
                data-vaul-no-drag
                disabled={pending}
                id="event-preview-start"
                onChange={(event) => onChange({ ...draft, startTime: event.target.value })}
                type="time"
                value={draft.startTime}
              />
            </div>
            <div>
              <Label className="block" htmlFor="event-preview-end">Fin</Label>
              <Input
                className="mt-1"
                data-vaul-no-drag
                disabled={pending}
                id="event-preview-end"
                onChange={(event) => onChange({ ...draft, endTime: event.target.value })}
                type="time"
                value={draft.endTime}
              />
            </div>
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="min-h-11 rounded-lg px-3 py-2 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="min-h-11 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
            disabled={pending || !draft.date}
            onClick={onSave}
            type="button"
          >
            Guardar
          </button>
        </div>
      </div>
    </>
  );
}

export function EventPreviewModal({
  event,
  occurrenceDate,
  onClose,
}: {
  event: CalendarEvent;
  occurrenceDate?: Date;
  onClose: () => void;
}) {
  const { createException, deleteEvent, deleteException, updateEvent } = useEventMutations();
  const isMobile = useIsMobile(1023);
  const [currentEvent, setCurrentEvent] = useState(event);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event.title);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(() => scheduleDraftFrom(event));
  const [locationEditing, setLocationEditing] = useState(false);
  const [locationDraft, setLocationDraft] = useState(event.location ?? "");
  const [colorOpen, setColorOpen] = useState(false);
  const [pendingField, setPendingField] = useState<EventDraftField | null>(null);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipPending, setSkipPending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingExceptionId, setPendingExceptionId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const locationCancelRef = useRef(false);
  const recurring = Boolean(currentEvent.recurrenceType);
  const exceptionsQuery = useEventExceptionsQuery(recurring ? currentEvent.id : "");
  const exceptions = exceptionsQuery.data ?? [];
  const occurrenceKey = recurring ? toDateKey(occurrenceDate ?? parseDateOnly(currentEvent.date)) : null;

  useEffect(() => {
    if (!titleEditing || !titleInputRef.current) return;
    resizeTitleInput(titleInputRef.current);
    titleInputRef.current.focus();
    titleInputRef.current.select();
  }, [titleEditing]);

  const savePatch = async (field: EventDraftField, payload: Partial<CalendarEventUpdatePayload>, successMessage: string) => {
    if (pendingField) return null;
    setPendingField(field);
    try {
      const effectiveFrom = recurring && occurrenceKey ? { effectiveFrom: occurrenceKey } : {};
      const updated = await updateEvent.mutateAsync({ id: currentEvent.id, payload: { ...effectiveFrom, ...payload } });
      if (effectiveFrom.effectiveFrom) {
        toast.success(successMessage);
        onClose();
        return updated;
      }
      setCurrentEvent(updated);
      toast.success(successMessage);
      return updated;
    } catch {
      toast.error("No pudimos actualizar el evento.");
      return null;
    } finally {
      setPendingField(null);
    }
  };

  const closeTitleEditor = () => {
    setTitleEditing(false);
    setTitleDraft(currentEvent.title);
  };

  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (!title) {
      toast.error("El título no puede estar vacío.");
      return;
    }
    if (title === currentEvent.title) {
      closeTitleEditor();
      return;
    }
    const updated = await savePatch("title", { title }, "Título actualizado");
    if (updated) setTitleEditing(false);
  };

  const openScheduleEditor = () => {
    setScheduleDraft(scheduleDraftFrom(currentEvent));
    setScheduleEditing(true);
  };

  const cancelScheduleEditor = () => {
    setScheduleDraft(scheduleDraftFrom(currentEvent));
    setScheduleEditing(false);
  };

  const saveSchedule = async () => {
    if (!scheduleDraft.date) {
      toast.error("Selecciona una fecha.");
      return;
    }
    if (!scheduleDraft.allDay && timeToMin(scheduleDraft.endTime) <= timeToMin(scheduleDraft.startTime)) {
      toast.error("La hora final debe ser posterior a la inicial.");
      return;
    }
    const updated = await savePatch("schedule", {
      allDay: scheduleDraft.allDay,
      date: scheduleDraft.date,
      endMin: scheduleDraft.allDay ? undefined : timeToMin(scheduleDraft.endTime),
      startMin: scheduleDraft.allDay ? undefined : timeToMin(scheduleDraft.startTime),
    }, "Horario actualizado");
    if (updated) {
      setScheduleDraft(scheduleDraftFrom(updated));
      setScheduleEditing(false);
    }
  };

  const handleScheduleOpenChange = (open: boolean) => {
    if (open) openScheduleEditor();
    else if (scheduleEditing) cancelScheduleEditor();
  };

  const saveRecurrenceType = async (value: string) => {
    const type = value === "NONE" ? null : value as EventRecurrenceType;
    const eventDateValue = parseDateOnly(currentEvent.date);
    await savePatch("recurrence", {
      recurrenceType: type,
      recurrenceInterval: Math.max(currentEvent.recurrenceInterval, 1),
      recurrenceDaysOfWeek: type === "WEEKLY"
        ? currentEvent.recurrenceDaysOfWeek.length > 0 ? currentEvent.recurrenceDaysOfWeek : [eventDateValue.getDay()]
        : [],
      recurrenceDayOfMonth: type === "MONTHLY"
        ? currentEvent.recurrenceDayOfMonth ?? eventDateValue.getDate()
        : null,
      recurrenceEndsAt: type ? currentEvent.recurrenceEndsAt : null,
    }, "Recurrencia actualizada");
  };

  const openLocationEditor = () => {
    locationCancelRef.current = false;
    setLocationDraft(currentEvent.location ?? "");
    setLocationEditing(true);
  };

  const cancelLocationEditor = () => {
    locationCancelRef.current = true;
    setLocationDraft(currentEvent.location ?? "");
    setLocationEditing(false);
  };

  const saveLocation = async () => {
    const location = locationDraft.trim();
    if (location === (currentEvent.location ?? "")) {
      cancelLocationEditor();
      return;
    }
    const updated = await savePatch("location", { location }, "Ubicación actualizada");
    if (updated) setLocationEditing(false);
  };

  const saveColor = async (color: string) => {
    if (color === currentEvent.color) {
      setColorOpen(false);
      return;
    }
    const updated = await savePatch("color", { color }, "Color actualizado");
    if (updated) setColorOpen(false);
  };

  const saveReminder = async (value: number) => {
    if (value === currentEvent.remindBeforeMin) return;
    await savePatch("reminder", { remindBeforeMin: value }, "Recordatorio actualizado");
  };

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(currentEvent.id);
      toast.success("Evento eliminado");
      onClose();
    } catch (error) {
      toast.error((error as { message?: string } | null)?.message ?? "No pudimos eliminar el evento.");
    }
  };

  const confirmSkip = async () => {
    if (!occurrenceKey || skipPending) return;
    setSkipPending(true);
    try {
      await createException.mutateAsync({
        eventId: currentEvent.id,
        payload: { date: occurrenceKey, action: "skip" },
      });
      toast.success("Evento saltado ese día");
      setSkipConfirmOpen(false);
      onClose();
    } catch (error) {
      toast.error((error as { message?: string } | null)?.message ?? "No pudimos saltar el evento.");
    } finally {
      setSkipPending(false);
    }
  };

  const restoreException = async (exceptionId: string) => {
    if (pendingExceptionId) return;
    setPendingExceptionId(exceptionId);
    try {
      await deleteException.mutateAsync({ eventId: currentEvent.id, exceptionId });
      toast.success("Excepción eliminada; día restaurado");
    } catch (error) {
      toast.error((error as { message?: string } | null)?.message ?? "No pudimos restaurar el día.");
    } finally {
      setPendingExceptionId(null);
    }
  };

  const time = currentEvent.allDay || currentEvent.startMin === null || currentEvent.endMin === null
    ? "Todo el día"
    : `De ${minToTime(currentEvent.startMin)} a ${minToTime(currentEvent.endMin)}`;
  const duration = eventDuration(currentEvent);
  const meetingUrl = externalUrl(currentEvent.location);
  const eventColor = currentEvent.color ?? PROJECT_COLORS[0] ?? "#303e51";
  const scheduleTrigger = (
    <button aria-label="Editar fecha y horario" className="min-w-0 flex-1 text-left" disabled={pendingField !== null} type="button">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-body-md text-body-md font-semibold capitalize text-on-surface">{eventDate(currentEvent.date)}</p>
        {duration && <Badge variant="neutral">{duration}</Badge>}
      </div>
      <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{time}</p>
    </button>
  );
  const scheduleEditor = (
    <EventScheduleEditor
      draft={scheduleDraft}
      fullWidth={isMobile}
      onCancel={cancelScheduleEditor}
      onChange={setScheduleDraft}
      onSave={() => void saveSchedule()}
      pending={pendingField !== null}
    />
  );

  return (
    <>
      <PreviewSheet
      eyebrow="Evento"
      eyebrowBadge
      eyebrowClassName="border-secondary/20 bg-secondary-container text-secondary"
      eyebrowIcon={CalendarDays}
      bodyHeader={
        <div className="mb-5 min-w-0">
          <div className="flex min-w-0 items-start gap-3">
            <Popover onOpenChange={setColorOpen} open={colorOpen}>
              <PopoverTrigger asChild>
                <button
                  aria-expanded={colorOpen}
                  aria-label="Cambiar color del evento"
                  className="group -ml-1 flex size-8 shrink-0 items-center justify-center self-center rounded-full outline-none hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-wait disabled:opacity-60"
                  disabled={pendingField !== null}
                  type="button"
                >
                  <span aria-hidden="true" className="size-3.5 rounded-full shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: eventColor }} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto min-w-[15rem]">
                <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Color del evento</p>
                <ColorPicker disabled={pendingField !== null} onChange={(color) => void saveColor(color)} value={eventColor} />
              </PopoverContent>
            </Popover>
            {titleEditing ? (
              <Textarea
                aria-busy={pendingField === "title"}
                aria-label="Título del evento"
                autoComplete="off"
                className="block max-h-28 min-h-0 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-headline-md text-headline-md text-on-surface outline-none focus:border-0 focus:outline-none focus:ring-0 [overflow-wrap:anywhere] sm:font-headline-lg sm:text-headline-lg"
                data-vaul-no-drag
                disabled={pendingField !== null}
                maxLength={200}
                onBlur={() => {
                  window.requestAnimationFrame(() => {
                    if (document.activeElement !== titleInputRef.current && pendingField !== "title") void saveTitle();
                  });
                }}
                onChange={(event) => {
                  setTitleDraft(event.target.value);
                  resizeTitleInput(event.currentTarget);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveTitle();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeTitleEditor();
                  }
                }}
                ref={titleInputRef}
                rows={1}
                variant="plain"
                value={titleDraft}
                wrap="soft"
              />
            ) : (
              <button
                aria-label="Editar título del evento"
                className="group inline-flex max-w-full items-start gap-2 text-left"
                disabled={pendingField !== null}
                onClick={() => {
                  setTitleDraft(currentEvent.title);
                  setTitleEditing(true);
                }}
                type="button"
              >
                <span className="min-w-0 break-words font-headline-md text-headline-md text-on-surface [overflow-wrap:anywhere] sm:font-headline-lg sm:text-headline-lg">{currentEvent.title}</span>
                <Pencil aria-hidden="true" className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" size={14} />
              </button>
            )}
          </div>
        </div>
      }
      footer={
        <div className="flex w-full gap-2.5">
          {meetingUrl && (
            <Button
              asChild
              className="h-12 flex-1 rounded-xl px-3 font-label-md text-label-md font-semibold text-on-surface-variant hover:text-on-surface"
              size="default"
              variant="outline"
            >
              <a
              href={meetingUrl}
              rel="noreferrer"
              target="_blank"
              >
                <Video aria-hidden="true" size={16} /> Unirse
              </a>
            </Button>
          )}
          <Button
            className={cn("h-12 rounded-xl border-error/40 px-3 font-label-md text-label-md font-semibold text-error hover:bg-error-container/30", meetingUrl ? "flex-1" : "w-full")}
            disabled={pendingField !== null || deleteEvent.isPending}
            onClick={() => setDeleteConfirmOpen(true)}
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" size={16} /> Eliminar
          </Button>
        </div>
      }
      onClose={onClose}
      title={currentEvent.title}
      titlePlacement="body"
    >
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-low/70 p-4 sm:p-5">
          <div className="space-y-4">
            <DetailRow icon={CalendarDays}>
              <div className="flex items-start justify-between gap-2">
                {isMobile ? (
                  <DrawerNestedRoot
                    fixed
                    handleOnly
                    onOpenChange={handleScheduleOpenChange}
                    open={scheduleEditing}
                  >
                    <DrawerTrigger asChild>{scheduleTrigger}</DrawerTrigger>
                    <DrawerContent className="flex h-auto min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-none flex-col rounded-t-2xl border-outline-variant bg-surface-bright p-0 shadow-cadence-3 data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-1rem)]">
                      <DrawerHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-outline-variant px-5 py-4 !text-left">
                        <div className="min-w-0">
                          <DrawerTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">
                            Fecha y hora
                          </DrawerTitle>
                          <DrawerDescription className="!text-left">
                            {scheduleDraftLabel(scheduleDraft)}
                          </DrawerDescription>
                        </div>
                        <DrawerClose asChild>
                          <button
                            aria-label="Cerrar selector de fecha y hora"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                            type="button"
                          >
                            <X size={19} />
                          </button>
                        </DrawerClose>
                      </DrawerHeader>
                      <div className="w-full">{scheduleEditor}</div>
                    </DrawerContent>
                  </DrawerNestedRoot>
                ) : (
                  <Popover onOpenChange={handleScheduleOpenChange} open={scheduleEditing}>
                    <PopoverTrigger asChild>{scheduleTrigger}</PopoverTrigger>
                    <PopoverContent
                      align="end"
                      avoidCollisions
                      className="w-auto max-w-[var(--radix-popover-content-available-width)] overflow-hidden p-0"
                      collisionPadding={{ bottom: 16, left: 16, right: 16, top: 16 }}
                      sideOffset={8}
                    >
                      <div className="border-b border-outline-variant px-4 py-3">
                        <p className="font-label-caps text-label-caps text-on-surface-variant">Fecha y hora</p>
                        <p className="mt-0.5 max-w-[20rem] font-body-sm text-body-sm font-semibold capitalize text-on-surface">
                          {scheduleDraftLabel(scheduleDraft)}
                        </p>
                      </div>
                      {scheduleEditor}
                    </PopoverContent>
                  </Popover>
                )}
                <Pencil aria-hidden="true" className="mt-1 shrink-0 text-on-surface-variant" size={14} />
              </div>
            </DetailRow>

            <DetailRow divided icon={MapPin}>
              {locationEditing ? (
                <div className="min-w-0">
                  <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Ubicación</p>
                  <Input
                    aria-busy={pendingField === "location"}
                    aria-label="Ubicación o enlace"
                    autoFocus
                    className="mt-1 block min-w-0 w-full font-body-md text-body-md font-semibold text-on-surface placeholder:text-on-surface-variant/70"
                    data-vaul-no-drag
                    disabled={pendingField !== null}
                    id="event-preview-location"
                    onBlur={() => {
                      window.requestAnimationFrame(() => {
                        if (!locationCancelRef.current && document.activeElement !== locationInputRef.current && pendingField !== "location") void saveLocation();
                      });
                    }}
                    onChange={(event) => setLocationDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveLocation();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelLocationEditor();
                      }
                    }}
                    placeholder="Añadir ubicación o enlace"
                    ref={locationInputRef}
                    variant="plain"
                    value={locationDraft}
                  />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <button aria-label={currentEvent.location ? "Editar ubicación" : "Añadir ubicación"} className="min-w-0 flex-1 text-left" disabled={pendingField !== null} onClick={openLocationEditor} type="button">
                    <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Ubicación</p>
                    {currentEvent.location ? (
                      meetingUrl ? (
                        <span className="mt-1 inline-flex min-w-0 items-start gap-1.5 break-words font-body-md text-body-md font-semibold text-secondary [overflow-wrap:anywhere]"><ExternalLink aria-hidden="true" className="mt-0.5 shrink-0" size={15} />{currentEvent.location}</span>
                      ) : (
                        <span className="mt-1 block break-words font-body-md text-body-md font-semibold text-on-surface [overflow-wrap:anywhere]">{currentEvent.location}</span>
                      )
                    ) : (
                      <span className="mt-1 block font-body-sm text-body-sm font-semibold text-secondary">Añadir ubicación</span>
                    )}
                  </button>
                  <Pencil aria-hidden="true" className="mt-1 shrink-0 text-on-surface-variant" size={14} />
                </div>
              )}
            </DetailRow>

            <DetailRow divided icon={Repeat2}>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Recurrencia</p>
              <Select disabled={pendingField !== null} onValueChange={(value) => void saveRecurrenceType(value)} value={currentEvent.recurrenceType ?? "NONE"}>
                <SelectTrigger aria-label="Cambiar recurrencia" className="h-9 max-w-[12rem] border-transparent bg-transparent px-1 font-body-md text-body-md font-semibold text-on-surface shadow-none hover:bg-surface-container-low" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {RECURRENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailRow>

            {occurrenceDate && recurring && (
              <DetailRow divided icon={CalendarDays}>
                <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Ocurrencia seleccionada</p>
                <p className="mt-0.5 capitalize font-body-md text-body-md font-semibold text-on-surface">{eventDate(occurrenceKey ?? currentEvent.date)}</p>
              </DetailRow>
            )}

            <DetailRow divided icon={Bell}>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Recordatorio</p>
              <Select disabled={pendingField !== null} onValueChange={(value) => void saveReminder(Number(value))} value={String(currentEvent.remindBeforeMin)}>
                <SelectTrigger aria-label="Cambiar recordatorio" className="h-9 max-w-[12rem] border-transparent bg-transparent px-1 font-body-md text-body-md font-semibold text-on-surface shadow-none hover:bg-surface-container-low" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {reminderOptions(currentEvent.remindBeforeMin).map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailRow>
          </div>
        </section>

        {recurring && exceptions.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-low/70 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Excepciones</p>
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Restaura los días que quitaste de este evento.</p>
              </div>
              <Badge variant="neutral">{exceptions.length}</Badge>
            </div>
            <ul className="mt-3 divide-y divide-outline-variant/70">
              {exceptions.map((exception) => (
                <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={exception.id}>
                  <div className="min-w-0">
                    <p className="truncate font-body-sm text-body-sm font-semibold capitalize text-on-surface">{exceptionDate(exception.date)}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {exception.action === "skip"
                        ? "Día saltado"
                        : exception.targetDate
                          ? `Movido al ${exceptionDate(exception.targetDate)}`
                          : "Horario cambiado ese día"}
                    </p>
                  </div>
                  <Button
                    aria-label={`Restaurar ${exceptionDate(exception.date)}`}
                    className="shrink-0 rounded-lg px-3 font-label-md text-label-md text-on-surface-variant"
                    disabled={pendingExceptionId !== null}
                    onClick={() => void restoreException(exception.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw aria-hidden="true" size={14} /> Restaurar
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {occurrenceKey && recurring && (
          <section className="border-t border-outline-variant pt-4">
            <Button
              className="min-h-11 w-full justify-center rounded-xl border-error/40 font-label-md text-label-md font-semibold text-error hover:bg-error-container/30"
              disabled={pendingField !== null || skipPending}
              onClick={() => setSkipConfirmOpen(true)}
              type="button"
              variant="outline"
            >
              <CalendarX aria-hidden="true" size={16} /> Saltar este día
            </Button>
            <p className="mt-2 text-center font-body-sm text-body-sm text-on-surface-variant">
              No se notificará el {eventDate(occurrenceKey)}.
            </p>
          </section>
        )}
        </div>
      </PreviewSheet>

      {skipConfirmOpen && occurrenceKey && (
        <ConfirmModal
          cancelLabel="Cancelar"
          confirmLabel="Saltar este día"
          danger
          loading={skipPending}
          message={<>¿Saltar el evento «{currentEvent.title}» el {eventDate(occurrenceKey)}? No se notificará ese día.</>}
          onClose={() => setSkipConfirmOpen(false)}
          onConfirm={() => void confirmSkip()}
          title="¿Saltar evento este día?"
        />
      )}

      {deleteConfirmOpen && (
        <ConfirmModal
          cancelLabel="Cancelar"
          confirmLabel="Eliminar evento"
          danger
          loading={deleteEvent.isPending}
          message={<>¿Eliminar el evento «{currentEvent.title}»? Esta acción no se puede deshacer.</>}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={() => void handleDelete()}
          title="¿Eliminar evento?"
        />
      )}
    </>
  );
}
