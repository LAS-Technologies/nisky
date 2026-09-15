"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CalendarX, Check, CheckCircle2, ChevronDown, Clock3, PauseCircle, Pencil, PlayCircle, Repeat2, RotateCcw, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { Project, TimeBlock, TimeBlockException } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PreviewSheet } from "@/components/ui/PreviewSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerNestedRoot, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useProjectsQuery } from "@/features/projects/hooks/useProjects";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { UpdateTimeBlockPayload } from "../api/timeblocks";
import { useBlockExceptionsQuery, useTimeBlockMutations } from "../hooks/useTimeBlocks";
import { DAY_NAMES, DAY_NAMES_SHORT, DAY_ORDER, calendarDateFromInstant, minToTime, parseDateOnly, timeToMin, toDateKey } from "../lib/time";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";

const REMIND_OPTIONS = [
  { value: 0, label: "Sin aviso" },
  { value: 5, label: "5 min antes" },
  { value: 10, label: "10 min antes" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
] as const;

const REPEAT_OPTIONS = [
  { value: 1, label: "Cada semana" },
  { value: 2, label: "Cada 2 semanas" },
  { value: 3, label: "Cada 3 semanas" },
  { value: 4, label: "Cada 4 semanas" },
] as const;

type BlockDraftField = "name" | "project" | "schedule" | "reminder" | "active";
type BlockScheduleMode = "oneOff" | "recurring";
type ScheduleDetailsDraft = {
  date: string;
  daysOfWeek: number[];
  mode: BlockScheduleMode;
  repeatEveryWeeks: number;
  repeatEndsAt: string;
};

function blockDate(value: string | Date) {
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  return date.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function reminderLabel(minutes: number) {
  if (minutes === 0) return "Sin aviso previo";
  if (minutes < 60) return `${minutes} minutos antes`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hora" : "horas"} antes`;
  return `${minutes} minutos antes`;
}

function reminderOptions(currentValue: number) {
  if (REMIND_OPTIONS.some((option) => option.value === currentValue)) return REMIND_OPTIONS;
  return [...REMIND_OPTIONS, { value: currentValue, label: reminderLabel(currentValue) }].sort((a, b) => a.value - b.value);
}

function blockDuration(block: TimeBlock) {
  const duration = block.endMin - block.startMin;
  if (duration < 60) return `${duration} min`;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function orderedDays(days: number[]) {
  return days.slice().sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function scheduleDetailsFrom(block: TimeBlock, occurrenceDate?: Date): ScheduleDetailsDraft {
  const recurrenceStart = block.recurrenceStartsAt?.slice(0, 10)
    ?? toDateKey(calendarDateFromInstant(block.createdAt));
  return {
    date: block.date?.slice(0, 10) ?? recurrenceStart ?? (occurrenceDate ? toDateKey(occurrenceDate) : toDateKey(new Date())),
    daysOfWeek: orderedDays(block.daysOfWeek),
    mode: block.date ? "oneOff" : "recurring",
    repeatEveryWeeks: block.repeatEveryWeeks,
    repeatEndsAt: block.repeatEndsAt?.slice(0, 10) ?? "",
  };
}

function exceptionDate(value: string) {
  return parseDateOnly(value).toLocaleDateString("es-DO", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replaceAll(".", "");
}

function scheduleDetailsLabel(draft: ScheduleDetailsDraft) {
  if (draft.mode === "oneOff") return draft.date ? `${blockDate(draft.date)} · Solo este día` : "Selecciona una fecha";
  const days = orderedDays(draft.daysOfWeek).map((day) => DAY_NAMES_SHORT[day]).join(" · ");
  const repeat = draft.repeatEveryWeeks === 1 ? "Cada semana" : `Cada ${draft.repeatEveryWeeks} semanas`;
  return `${days || "Selecciona los días"} · ${repeat} · Desde ${draft.date ? blockDate(draft.date) : "la fecha de inicio"}${draft.repeatEndsAt ? ` · Hasta ${blockDate(draft.repeatEndsAt)}` : ""}`;
}

function scheduleDraftFrom(block: TimeBlock) {
  return {
    endTime: minToTime(block.endMin),
    startTime: minToTime(block.startMin),
  };
}

function resizeTitleInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
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

export function TimeBlockPreviewModal({
  block,
  project,
  occurrenceDate,
  onClose,
  onSkipDay,
}: {
  block: TimeBlock;
  project?: Project | null;
  occurrenceDate?: Date;
  onClose: () => void;
  onSkipDay?: (date: string) => Promise<void>;
}) {
  const { deleteException, remove, update } = useTimeBlockMutations();
  const [currentBlock, setCurrentBlock] = useState(block);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(block.name ?? "");
  const [projectOpen, setProjectOpen] = useState(false);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(() => scheduleDraftFrom(block));
  const [scheduleDetailsEditing, setScheduleDetailsEditing] = useState(false);
  const [scheduleDetailsDraft, setScheduleDetailsDraft] = useState(() => scheduleDetailsFrom(block, occurrenceDate));
  const [pendingField, setPendingField] = useState<BlockDraftField | null>(null);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipPending, setSkipPending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [pendingExceptionId, setPendingExceptionId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const projectsQuery = useProjectsQuery();
  const recurring = !currentBlock.date;
  const exceptionsQuery = useBlockExceptionsQuery(recurring ? currentBlock.id : null);
  const exceptions = exceptionsQuery.data ?? [];
  const occurrenceKey = occurrenceDate ? toDateKey(occurrenceDate) : null;

  useEffect(() => {
    if (!nameEditing || !titleInputRef.current) return;
    resizeTitleInput(titleInputRef.current);
    titleInputRef.current.focus();
    titleInputRef.current.select();
  }, [nameEditing]);

  const savePatch = async (field: BlockDraftField, payload: UpdateTimeBlockPayload, successMessage: string) => {
    if (pendingField) return null;
    setPendingField(field);
    try {
      const effectiveFrom = recurring && occurrenceKey ? { effectiveFrom: occurrenceKey } : {};
      const updated = await update.mutateAsync({ id: currentBlock.id, payload: { ...effectiveFrom, ...payload } });
      if (effectiveFrom.effectiveFrom) {
        toast.success(successMessage);
        onClose();
        return updated;
      }
      setCurrentBlock(updated);
      toast.success(successMessage);
      return updated;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar el bloque."));
      return null;
    } finally {
      setPendingField(null);
    }
  };

  const closeNameEditor = () => {
    setNameEditing(false);
    setNameDraft(currentBlock.name ?? "");
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (name === (currentBlock.name ?? "")) {
      closeNameEditor();
      return;
    }
    const updated = await savePatch("name", { name: name || null }, "Nombre actualizado");
    if (updated) setNameEditing(false);
  };

  const openScheduleEditor = () => {
    setScheduleDraft(scheduleDraftFrom(currentBlock));
    setScheduleEditing(true);
  };

  const cancelScheduleEditor = () => {
    setScheduleDraft(scheduleDraftFrom(currentBlock));
    setScheduleEditing(false);
  };

  const saveSchedule = async () => {
    const startMin = timeToMin(scheduleDraft.startTime);
    const endMin = timeToMin(scheduleDraft.endTime);
    if (endMin - startMin < 5) {
      toast.error("El bloque debe durar al menos 5 minutos.");
      return;
    }
    const updated = await savePatch("schedule", { startMin, endMin }, "Horario actualizado");
    if (updated) {
      setScheduleDraft(scheduleDraftFrom(updated));
      setScheduleEditing(false);
    }
  };

  const openScheduleDetailsEditor = () => {
    setScheduleDetailsDraft(scheduleDetailsFrom(currentBlock, occurrenceDate));
    setScheduleDetailsEditing(true);
  };

  const cancelScheduleDetailsEditor = () => {
    setScheduleDetailsDraft(scheduleDetailsFrom(currentBlock, occurrenceDate));
    setScheduleDetailsEditing(false);
  };

  const saveScheduleDetails = async () => {
    const isOneOff = scheduleDetailsDraft.mode === "oneOff";
    const oneOffDate = scheduleDetailsDraft.date;
    if (isOneOff && (!oneOffDate || Number.isNaN(parseDateOnly(oneOffDate).getTime()))) {
      toast.error("Selecciona una fecha válida para el bloque.");
      return;
    }
    const date = isOneOff ? oneOffDate : null;
    const days = isOneOff
      ? [parseDateOnly(oneOffDate).getDay()]
      : orderedDays(scheduleDetailsDraft.daysOfWeek);
    if (days.length === 0) {
      toast.error("Selecciona al menos un día.");
      return;
    }
    const updated = await savePatch("schedule", {
      date,
      daysOfWeek: days,
      repeatEveryWeeks: isOneOff ? 1 : scheduleDetailsDraft.repeatEveryWeeks,
      repeatEndsAt: isOneOff ? null : scheduleDetailsDraft.repeatEndsAt || null,
    }, "Programación actualizada");
    if (updated) {
      setScheduleDetailsDraft(scheduleDetailsFrom(updated, occurrenceDate));
      setScheduleDetailsEditing(false);
    }
  };

  const saveReminder = async (value: number) => {
    if (value === currentBlock.remindBeforeMin) return;
    await savePatch("reminder", { remindBeforeMin: value }, "Recordatorio actualizado");
  };

  const toggleActive = async () => {
    await savePatch("active", { isActive: !currentBlock.isActive }, currentBlock.isActive ? "Bloque pausado" : "Bloque activado");
  };

  const projectOptions = Array.from(
    new Map(
      [...(projectsQuery.data ?? []), ...(project ? [project] : [])].map((option) => [option.id, option]),
    ).values(),
  );
  const selectedProject = projectOptions.find((option) => option.id === currentBlock.projectId) ?? null;
  const selectProject = async (projectId: string | null) => {
    setProjectOpen(false);
    await savePatch("project", { projectId }, "Proyecto actualizado");
  };

  const title = currentBlock.name ?? selectedProject?.name ?? "Tiempo libre";
  const confirmSkip = async () => {
    if (!occurrenceKey || !onSkipDay || skipPending) return;
    setSkipPending(true);
    try {
      await onSkipDay(occurrenceKey);
      setSkipConfirmOpen(false);
      onClose();
    } finally {
      setSkipPending(false);
    }
  };

  const deleteBlock = async () => {
    if (deletePending) return;
    setDeletePending(true);
    try {
      await remove.mutateAsync(currentBlock.id);
      toast.success("Bloque eliminado");
      setDeleteConfirmOpen(false);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos eliminar el bloque."));
    } finally {
      setDeletePending(false);
    }
  };

  const restoreException = async (exception: TimeBlockException) => {
    if (pendingExceptionId) return;
    setPendingExceptionId(exception.id);
    try {
      await deleteException.mutateAsync({ blockId: currentBlock.id, exceptionId: exception.id });
      toast.success("Excepción eliminada; día restaurado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos restaurar el día."));
    } finally {
      setPendingExceptionId(null);
    }
  };

  const isMobile = useIsMobile(1023);
  const handleScheduleOpenChange = (open: boolean) => {
    if (open) openScheduleEditor();
    else if (scheduleEditing) cancelScheduleEditor();
  };
  const handleScheduleDetailsOpenChange = (open: boolean) => {
    if (open) openScheduleDetailsEditor();
    else if (scheduleDetailsEditing) cancelScheduleDetailsEditor();
  };

  const timeTrigger = (
    <button aria-label="Editar horario del bloque" className="min-w-0 flex-1 text-left" disabled={pendingField !== null} type="button">
      <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{recurring ? "Horario habitual" : "Horario"}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="font-headline-md text-headline-md text-on-surface">{minToTime(currentBlock.startMin)} – {minToTime(currentBlock.endMin)}</span>
        <Badge className="bg-primary-fixed text-primary" variant="neutral">{blockDuration(currentBlock)}</Badge>
      </div>
    </button>
  );

  const timeEditor = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="block" htmlFor="time-block-preview-start">Inicio</Label>
          <Input className="mt-1" data-vaul-no-drag disabled={pendingField !== null} id="time-block-preview-start" onChange={(event) => setScheduleDraft((current) => ({ ...current, startTime: event.target.value }))} type="time" value={scheduleDraft.startTime} />
        </div>
        <div>
          <Label className="block" htmlFor="time-block-preview-end">Fin</Label>
          <Input className="mt-1" data-vaul-no-drag disabled={pendingField !== null} id="time-block-preview-end" onChange={(event) => setScheduleDraft((current) => ({ ...current, endTime: event.target.value }))} type="time" value={scheduleDraft.endTime} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-outline-variant pt-4">
        <Button className="h-10 min-h-0 rounded-lg px-3 font-label-md text-label-md text-on-surface-variant" disabled={pendingField !== null} onClick={cancelScheduleEditor} size="sm" type="button" variant="ghost">Cancelar</Button>
        <Button className="h-10 min-h-0 rounded-lg px-3 font-label-md text-label-md font-semibold text-on-primary" disabled={pendingField !== null} onClick={() => void saveSchedule()} size="sm" type="button">Guardar</Button>
      </div>
    </div>
  );

  const frequencyTrigger = (
    <button aria-label="Editar frecuencia del bloque" className="min-w-0 flex-1 text-left" disabled={pendingField !== null} type="button">
      <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{recurring ? "Frecuencia" : "Fecha del bloque"}</p>
      {recurring ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {orderedDays(currentBlock.daysOfWeek).map((day) => (
              <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary-fixed px-2 font-label-caps text-label-caps font-semibold text-primary" key={day}>
                {DAY_NAMES_SHORT[day]}
              </span>
            ))}
          </div>
          <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">
            {currentBlock.repeatEveryWeeks === 1 ? "Cada semana" : `Cada ${currentBlock.repeatEveryWeeks} semanas`}
            {currentBlock.repeatEndsAt ? ` · Hasta ${blockDate(currentBlock.repeatEndsAt)}` : " · Sin fecha final"}
          </p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Desde {blockDate(currentBlock.recurrenceStartsAt?.slice(0, 10) ?? calendarDateFromInstant(currentBlock.createdAt))}
          </p>
        </>
      ) : (
        <p className="mt-0.5 capitalize font-body-md text-body-md font-semibold text-on-surface">{blockDate(currentBlock.date ?? "")}</p>
      )}
    </button>
  );

  const frequencyEditor = (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant">Tipo de bloque</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            aria-pressed={scheduleDetailsDraft.mode === "oneOff"}
            className={cn(
              "flex min-h-16 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2 text-left transition-colors",
              scheduleDetailsDraft.mode === "oneOff"
                ? "border-primary bg-primary-container text-on-primary"
                : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low",
            )}
            disabled={pendingField !== null}
            onClick={() => setScheduleDetailsDraft((current) => ({ ...current, mode: "oneOff" }))}
            type="button"
          >
            <span className="flex items-center gap-2 font-label-md text-label-md font-semibold"><CalendarDays aria-hidden="true" size={15} /> Fecha única</span>
            <span className="font-body-sm text-body-sm opacity-80">Solo este día</span>
          </button>
          <button
            aria-pressed={scheduleDetailsDraft.mode === "recurring"}
            className={cn(
              "flex min-h-16 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2 text-left transition-colors",
              scheduleDetailsDraft.mode === "recurring"
                ? "border-primary bg-primary-container text-on-primary"
                : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low",
            )}
            disabled={pendingField !== null}
            onClick={() => setScheduleDetailsDraft((current) => ({ ...current, mode: "recurring" }))}
            type="button"
          >
            <span className="flex items-center gap-2 font-label-md text-label-md font-semibold"><Repeat2 aria-hidden="true" size={15} /> Recurrente</span>
            <span className="font-body-sm text-body-sm opacity-80">Se repite cada semana</span>
          </button>
        </div>
      </fieldset>

      {scheduleDetailsDraft.mode === "oneOff" ? (
        <div>
          <Label htmlFor="time-block-preview-date">Fecha</Label>
          <Input
            className="mt-1"
            data-vaul-no-drag
            id="time-block-preview-date"
            onChange={(event) => setScheduleDetailsDraft((current) => ({ ...current, date: event.target.value }))}
            type="date"
            value={scheduleDetailsDraft.date}
          />
          <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">El bloque aparecerá únicamente en esta fecha.</p>
        </div>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant">Días de repetición</legend>
            <ToggleGroup
              aria-label="Días de repetición"
              className="grid grid-cols-4 gap-2 sm:grid-cols-7"
              disabled={pendingField !== null}
              onValueChange={(values) => setScheduleDetailsDraft((current) => ({ ...current, daysOfWeek: values.map(Number) }))}
              type="multiple"
              value={scheduleDetailsDraft.daysOfWeek.map(String)}
            >
              {DAY_ORDER.map((day) => (
                <ToggleGroupItem aria-label={`Repetir los ${DAY_NAMES[day]}`} className="h-10 w-full rounded-lg px-1 font-label-caps text-[10px]" key={day} value={String(day)}>
                  {DAY_NAMES_SHORT[day]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Selecciona uno o más días.</p>
            <p className="rounded-lg bg-primary-fixed/60 px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
              Los cambios se aplicarán {occurrenceKey ?? scheduleDetailsDraft.date ? `desde el ${blockDate(occurrenceKey ?? scheduleDetailsDraft.date)}` : "desde la fecha original del bloque"}. No se rellenarán días anteriores.
            </p>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="time-block-preview-repeat">Intervalo</Label>
              <Select
                onValueChange={(value) => setScheduleDetailsDraft((current) => ({ ...current, repeatEveryWeeks: Number(value) }))}
                value={String(scheduleDetailsDraft.repeatEveryWeeks)}
              >
                <SelectTrigger className="mt-1 w-full" id="time-block-preview-repeat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="time-block-preview-repeat-end">Fecha final</Label>
              <Input
                className="mt-1"
                data-vaul-no-drag
                id="time-block-preview-repeat-end"
                onChange={(event) => setScheduleDetailsDraft((current) => ({ ...current, repeatEndsAt: event.target.value }))}
                type="date"
                value={scheduleDetailsDraft.repeatEndsAt}
              />
            </div>
          </div>
          <p className="-mt-2 font-body-sm text-body-sm text-on-surface-variant">Deja la fecha final vacía para repetir indefinidamente.</p>
        </>
      )}

      <div className="flex justify-end gap-2 border-t border-outline-variant pt-4">
        <Button className="h-10 min-h-0 rounded-lg px-3 font-label-md text-label-md text-on-surface-variant" disabled={pendingField !== null} onClick={cancelScheduleDetailsEditor} size="sm" type="button" variant="ghost">Cancelar</Button>
        <Button className="h-10 min-h-0 rounded-lg px-3 font-label-md text-label-md font-semibold text-on-primary" disabled={pendingField !== null} onClick={() => void saveScheduleDetails()} size="sm" type="button">Guardar</Button>
      </div>
    </div>
  );

  return (
    <>
      <PreviewSheet
        eyebrow="Bloque de tiempo"
        eyebrowBadge
        eyebrowClassName="border-primary/20 bg-primary-fixed text-primary"
        eyebrowIcon={Clock3}
        bodyHeader={
          <div className="mb-5 min-w-0 space-y-2.5">
          {nameEditing ? (
            <Textarea
              aria-busy={pendingField === "name"}
              aria-label="Nombre del bloque"
              autoComplete="off"
              className="block max-h-28 min-h-0 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-headline-lg text-headline-lg text-on-surface outline-none focus:border-0 focus:outline-none focus:ring-0 [overflow-wrap:anywhere]"
              data-vaul-no-drag
              disabled={pendingField !== null}
              maxLength={100}
              onBlur={() => {
                window.requestAnimationFrame(() => {
                  if (document.activeElement !== titleInputRef.current && pendingField !== "name") void saveName();
                });
              }}
              onChange={(event) => {
                setNameDraft(event.target.value);
                resizeTitleInput(event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveName();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeNameEditor();
                }
              }}
              placeholder="Nombre del bloque"
              ref={titleInputRef}
              rows={1}
              variant="plain"
              value={nameDraft}
              wrap="soft"
            />
          ) : (
            <button
              aria-label="Editar nombre del bloque"
              className="group inline-flex max-w-full items-start gap-2 text-left"
              disabled={pendingField !== null}
              onClick={() => {
                setNameDraft(currentBlock.name ?? "");
                setNameEditing(true);
              }}
              type="button"
            >
              <span className="min-w-0 break-words font-headline-lg text-headline-lg text-on-surface [overflow-wrap:anywhere]">{title}</span>
              <Pencil aria-hidden="true" className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" size={14} />
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 font-semibold" variant={currentBlock.isActive ? "success" : "neutral"}>
              {currentBlock.isActive ? <CheckCircle2 aria-hidden="true" size={13} /> : <PauseCircle aria-hidden="true" size={13} />}
              {currentBlock.isActive ? "Activo" : "Pausado"}
            </Badge>
            <Popover onOpenChange={setProjectOpen} open={projectOpen}>
              <PopoverTrigger asChild>
                <button
                  aria-label="Cambiar proyecto"
                  className={cn(
                    "inline-flex h-7 max-w-[13rem] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-label-md text-label-md font-semibold leading-4 outline-none transition-colors disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary/20",
                    selectedProject ? "border-transparent" : "border-outline-variant bg-surface-container-low text-on-surface-variant",
                  )}
                  disabled={pendingField !== null || projectsQuery.isLoading}
                  style={selectedProject ? {
                    backgroundColor: `color-mix(in srgb, ${selectedProject.color} 12%, transparent)`,
                    borderColor: selectedProject.color,
                    color: selectedProject.color,
                  } : undefined}
                  type="button"
                >
                  {selectedProject && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: selectedProject.color }} />}
                  <span className="min-w-0 truncate">{selectedProject?.name ?? "Sin proyecto"}</span>
                  <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-on-surface-variant" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <Command>
                  <CommandInput placeholder="Buscar proyecto..." />
                  <CommandList>
                    <CommandEmpty>No encontramos ese proyecto.</CommandEmpty>
                    <CommandGroup heading="Proyectos">
                      <CommandItem onSelect={() => void selectProject(null)} value="sin proyecto">
                        <Check className={cn("size-4", currentBlock.projectId === null ? "opacity-100" : "opacity-0")} />
                        <span>Sin proyecto</span>
                      </CommandItem>
                      {projectOptions.map((option) => (
                        <CommandItem key={option.id} onSelect={() => void selectProject(option.id)} value={`${option.name} ${option.id}`}>
                          <Check className={cn("size-4", currentBlock.projectId === option.id ? "opacity-100" : "opacity-0")} />
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                          <span className="min-w-0 truncate">{option.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          </div>
        }
        footer={
          <div className="flex w-full gap-2.5">
            <Button
              className="h-12 flex-1 rounded-xl px-3 font-label-md text-label-md font-semibold text-on-surface-variant hover:text-on-surface"
              disabled={pendingField !== null || skipPending || deletePending}
              onClick={() => void toggleActive()}
              type="button"
              variant="outline"
            >
              {currentBlock.isActive ? <PauseCircle aria-hidden="true" size={16} /> : <PlayCircle aria-hidden="true" size={16} />}
              {currentBlock.isActive ? "Pausar" : "Activar"}
            </Button>
            <Button
              className="h-12 flex-1 rounded-xl border-error/40 px-3 font-label-md text-label-md font-semibold text-error hover:bg-error-container/30"
              disabled={pendingField !== null || skipPending || deletePending}
              onClick={() => setDeleteConfirmOpen(true)}
              type="button"
              variant="outline"
            >
              <Trash2 aria-hidden="true" size={16} /> Eliminar
            </Button>
          </div>
        }
        onClose={onClose}
        tall
        title={title}
        titlePlacement="body"
      >
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-low/70 p-4 sm:p-5">
            <div className="space-y-4">
              <DetailRow icon={Clock3}>
                <div className="flex items-start justify-between gap-2">
                  {isMobile ? (
                    <DrawerNestedRoot fixed handleOnly onOpenChange={handleScheduleOpenChange} open={scheduleEditing}>
                      <DrawerTrigger asChild>{timeTrigger}</DrawerTrigger>
                      <DrawerContent className="flex h-auto min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-none flex-col rounded-t-2xl border-outline-variant bg-surface-bright p-0 shadow-cadence-3 data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-1rem)]">
                        <DrawerHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-outline-variant px-5 py-4 !text-left">
                          <div className="min-w-0">
                            <DrawerTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">Horario</DrawerTitle>
                            <DrawerDescription className="!text-left">{minToTime(currentBlock.startMin)} – {minToTime(currentBlock.endMin)}</DrawerDescription>
                          </div>
                          <DrawerClose asChild>
                            <button aria-label="Cerrar editor de horario" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button">
                              <X aria-hidden="true" size={19} />
                            </button>
                          </DrawerClose>
                        </DrawerHeader>
                        <div className="min-h-0 w-full flex-1 overflow-y-auto p-5">{timeEditor}</div>
                      </DrawerContent>
                    </DrawerNestedRoot>
                  ) : (
                    <Popover onOpenChange={handleScheduleOpenChange} open={scheduleEditing}>
                      <PopoverTrigger asChild>{timeTrigger}</PopoverTrigger>
                      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-4">
                        <div className="mb-4">
                          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Horario</p>
                          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Ajusta el bloque sin salir de la agenda.</p>
                        </div>
                        {timeEditor}
                      </PopoverContent>
                    </Popover>
                  )}
                  <Pencil aria-hidden="true" className="mt-1 shrink-0 text-on-surface-variant" size={14} />
                </div>
              </DetailRow>

              <DetailRow divided icon={recurring ? Repeat2 : CalendarDays}>
                <div className="flex items-start justify-between gap-2">
                  {isMobile ? (
                    <DrawerNestedRoot fixed handleOnly onOpenChange={handleScheduleDetailsOpenChange} open={scheduleDetailsEditing}>
                      <DrawerTrigger asChild>{frequencyTrigger}</DrawerTrigger>
                      <DrawerContent className="flex h-auto min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-none flex-col rounded-t-2xl border-outline-variant bg-surface-bright p-0 shadow-cadence-3 data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-1rem)]">
                        <DrawerHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-outline-variant px-5 py-4 !text-left">
                          <div className="min-w-0">
                            <DrawerTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">{recurring ? "Frecuencia" : "Fecha del bloque"}</DrawerTitle>
                            <DrawerDescription className="!text-left">{scheduleDetailsLabel(scheduleDetailsDraft)}</DrawerDescription>
                          </div>
                          <DrawerClose asChild>
                            <button aria-label="Cerrar editor de frecuencia" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button">
                              <X aria-hidden="true" size={19} />
                            </button>
                          </DrawerClose>
                        </DrawerHeader>
                        <div className="min-h-0 w-full flex-1 overflow-y-auto p-5">{frequencyEditor}</div>
                      </DrawerContent>
                    </DrawerNestedRoot>
                  ) : (
                    <Popover onOpenChange={handleScheduleDetailsOpenChange} open={scheduleDetailsEditing}>
                      <PopoverTrigger asChild>{frequencyTrigger}</PopoverTrigger>
                      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-4">
                        <div className="mb-4">
                          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{recurring ? "Frecuencia" : "Fecha del bloque"}</p>
                          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Organiza cuándo aparece este bloque.</p>
                        </div>
                        {frequencyEditor}
                      </PopoverContent>
                    </Popover>
                  )}
                  <Pencil aria-hidden="true" className="mt-1 shrink-0 text-on-surface-variant" size={14} />
                </div>
              </DetailRow>

            <DetailRow divided icon={Bell}>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Recordatorio</p>
              <Select disabled={pendingField !== null} onValueChange={(value) => void saveReminder(Number(value))} value={String(currentBlock.remindBeforeMin)}>
                <SelectTrigger aria-label="Cambiar recordatorio" className="h-9 max-w-[12rem] border-transparent bg-transparent px-1 font-body-md text-body-md font-semibold text-on-surface shadow-none hover:bg-surface-container-low" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {reminderOptions(currentBlock.remindBeforeMin).map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailRow>

            {occurrenceDate && recurring && (
              <DetailRow divided icon={CalendarDays}>
                <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Ocurrencia seleccionada</p>
                <p className="mt-0.5 capitalize font-body-md text-body-md font-semibold text-on-surface">{blockDate(occurrenceDate)}</p>
              </DetailRow>
            )}
            </div>
          </section>

          {recurring && exceptions.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-low/70 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Excepciones</p>
                  <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Restaura los días que quitaste de este bloque.</p>
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
                      onClick={() => void restoreException(exception)}
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

          {occurrenceKey && recurring && onSkipDay && currentBlock.isActive && (
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
                No se notificará ni contará como enfoque el {blockDate(occurrenceKey)}.
              </p>
            </section>
          )}
        </div>
      </PreviewSheet>

      {skipConfirmOpen && occurrenceDate && onSkipDay && (
        <ConfirmModal
          cancelLabel="Cancelar"
          confirmLabel="Saltar este día"
          danger
          loading={skipPending}
          message={<>¿Saltar este bloque el {blockDate(occurrenceDate)}? No se notificará ni contará como enfoque.</>}
          onClose={() => setSkipConfirmOpen(false)}
          onConfirm={() => void confirmSkip()}
          title="¿Saltar bloque este día?"
        />
      )}

      {deleteConfirmOpen && (
        <ConfirmModal
          cancelLabel="Cancelar"
          confirmLabel="Eliminar bloque"
          danger
          loading={deletePending}
          message={
            recurring
              ? "Se eliminará este bloque y todas sus ocurrencias futuras. Esta acción no se puede deshacer."
              : "Se eliminará este bloque de tu agenda. Esta acción no se puede deshacer."
          }
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={() => void deleteBlock()}
          title="¿Eliminar bloque?"
        />
      )}
    </>
  );
}
