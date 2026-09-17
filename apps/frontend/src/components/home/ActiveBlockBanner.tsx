"use client";

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  ListChecks,
  MapPin,
  Play,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRelativeDate, localDateKey } from "@/lib/utils";
import { PriorityChip } from "@/features/tasks/components/PriorityChip";
import { minToTime } from "@/features/timeblocks/lib/time";
import type {
  CalendarEvent,
  HomeNextActivity,
  Task,
  TimeBlockWithProject,
} from "@/types/entities";

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours} h ${mins} min`;
}

function useNowMinutes() {
  const [nowMin, setNowMin] = useState(
    () => new Date().getHours() * 60 + new Date().getMinutes(),
  );
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMin(new Date().getHours() * 60 + new Date().getMinutes());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return nowMin;
}

function useNowTimestamp() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function dueBadge(task: Task) {
  const todayKey = localDateKey(new Date());
  const overdue = task.dueDate && localDateKey(task.dueDate) < todayKey;
  const today = task.dueDate && localDateKey(task.dueDate) === todayKey;
  if (!task.dueDate) return null;
  return (
    <span
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap font-data-mono text-data-mono text-[11px] ${overdue ? "text-error" : "text-on-surface-variant"}`}
    >
      {overdue ? <AlertCircle size={11} /> : <CalendarDays size={11} />}
      {overdue ? "Atrasada" : today ? "Hoy" : localDateKey(task.dueDate)}
    </span>
  );
}

export function ActiveBlockBanner({
  block,
  nextActivity,
  tasks,
  activeEvent,
  onPlayPomodoro,
  onToggleTask,
}: {
  block: TimeBlockWithProject | null;
  nextActivity: HomeNextActivity | null;
  tasks: Task[];
  activeEvent: CalendarEvent | null;
  onPlayPomodoro: (taskId?: string, projectId?: string, timeBlockId?: string, timeBlockDate?: string) => void;
  onToggleTask: (task: Task) => void;
}) {
  const nowMin = useNowMinutes();
  const nowTimestamp = useNowTimestamp();

  if (activeEvent) {
    const color = activeEvent.color ?? "#303e51";
    const timeLabel = activeEvent.allDay
      ? "Todo el día"
      : `${minToTime(activeEvent.startMin ?? 0)}–${minToTime(activeEvent.endMin ?? 0)}`;
    return (
      <div
        className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-container-padding shadow-sm"
        style={{ borderTop: `3px solid ${color}` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: color }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            </span>
            <p className="inline-flex items-center rounded-full bg-secondary-fixed/70 px-2.5 py-1 font-body-sm text-body-sm font-semibold text-secondary">
              Ahora mismo
            </p>
          </div>
          <p className="font-data-mono text-data-mono text-xs text-on-surface-variant">
            {timeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-headline-sm text-headline-sm font-bold text-on-surface">
              {activeEvent.title}
            </p>
            {activeEvent.location && (
              <p className="mt-1 flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                <MapPin size={13} className="shrink-0" />
                <span className="line-clamp-1">{activeEvent.location}</span>
              </p>
            )}
          </div>
          <Link
            className="rounded-md border border-outline-variant px-3 py-2 font-label-caps text-label-caps text-primary hover:bg-surface-container-low"
            href="/timeblocks"
          >
            VER EN AGENDA
          </Link>
        </div>
      </div>
    );
  }

  if (!block) {
    if (nextActivity) {
      const diffMs = new Date(nextActivity.start).getTime() - nowTimestamp;
      const diffMin = Math.max(0, Math.round(diffMs / 60_000));
      const referenceDate = new Date(nowTimestamp);
      const whenLabel =
        localDateKey(nextActivity.start) === localDateKey(referenceDate)
          ? `En ${formatDuration(diffMin)}`
          : formatRelativeDate(nextActivity.start, false, referenceDate);
      const isEvent = nextActivity.kind === "EVENT";
      const label = isEvent
        ? nextActivity.event.title
        : nextActivity.block.project?.name ?? nextActivity.block.name ?? "Bloque de enfoque";
      const color = isEvent
        ? nextActivity.event.color ?? "#303e51"
        : nextActivity.block.project?.color ?? "#303e51";
      const timeLabel = isEvent
        ? nextActivity.event.allDay
          ? "Todo el día"
          : `${minToTime(nextActivity.startMin ?? 0)}–${minToTime(nextActivity.endMin ?? 0)}`
        : `${minToTime(nextActivity.block.startMin)}–${minToTime(nextActivity.block.endMin)}`;
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-container-padding shadow-sm">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary-fixed/70 px-2 py-0.5 font-label-caps text-label-caps font-semibold text-secondary">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-secondary/70"
              />
              Próxima actividad
            </span>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <p className="min-w-0 truncate font-headline-xs text-headline-xs font-semibold text-on-surface">
                {label}
              </p>
            </div>
            {isEvent && nextActivity.event.location && (
              <p className="mt-1 flex items-center gap-1.5 truncate font-body-sm text-body-sm text-on-surface-variant">
                <MapPin size={13} /> {nextActivity.event.location}
              </p>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-data-mono text-data-mono text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5 text-secondary">
                <CalendarDays size={13} /> {whenLabel}
              </span>
              <span aria-hidden="true" className="text-outline">
                ·
              </span>
              <span>
                {timeLabel}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-3">
            <Link
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 font-body-sm text-body-sm font-medium text-on-surface-variant hover:border-secondary hover:bg-surface-container-low hover:text-secondary"
              href="/timeblocks"
            >
              Ver agenda <ArrowRight size={14} />
            </Link>
            {!isEvent && (
              <button
                className="flex h-9 items-center gap-2 rounded-md border border-primary bg-primary px-4 font-body-sm text-body-sm font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container"
                onClick={() => {
                  onPlayPomodoro(
                    undefined,
                    nextActivity.block.projectId ?? undefined,
                    nextActivity.block.id,
                    localDateKey(new Date(nextActivity.start)),
                  );
                }}
                type="button"
              >
                <Play size={15} /> Comenzar enfoque
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-container-padding shadow-cadence-2">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-primary"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary-fixed text-secondary">
              <CalendarDays size={20} />
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-container px-2 py-0.5 font-label-caps text-label-caps font-semibold text-on-surface-variant">
                Agenda libre
              </span>
              <p className="mt-1.5 font-headline-sm text-headline-sm font-bold text-on-surface">
                Crea tu próximo bloque
              </p>
              <p className="mt-1 max-w-xl font-body-sm text-body-sm text-on-surface-variant">
                No tienes un bloque activo ni uno próximo. Reserva un espacio
                para proteger tu tiempo de enfoque.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-outline-variant pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 font-body-sm text-body-sm font-medium text-on-surface-variant hover:border-secondary hover:bg-surface-container-low hover:text-secondary"
              href="/timeblocks"
            >
              Ver agenda <ArrowRight size={14} />
            </Link>
            <Link
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-body-sm text-body-sm font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container"
              href="/timeblocks"
            >
              <Plus size={15} /> Nuevo bloque
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const MAX_VISIBLE_TASKS = 3;
  const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS);
  const remainingTasks = tasks.length - visibleTasks.length;
  const nextTask = visibleTasks[0];
  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED",
  ).length;
  const taskProgress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const label = block.project?.name ?? block.name ?? "Bloque de enfoque";
  const color = block.project?.color ?? "#303e51";
  const remaining = Math.max(0, block.endMin - nowMin);
  const firstTask = tasks[0];

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-container-padding shadow-cadence-2"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
          </span>
          <p className="inline-flex items-center rounded-full bg-secondary-fixed/70 px-2.5 py-1 font-body-sm text-body-sm font-semibold text-secondary">
            Ahora mismo
          </p>
        </div>
        <p className="font-data-mono text-data-mono text-xs text-on-surface-variant">
          {minToTime(block.startMin)}–{minToTime(block.endMin)}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-headline-md text-headline-md font-bold text-on-surface">
            {label}
          </p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Restan {formatDuration(remaining)}
            {tasks.length > 0 && ` · ${taskProgress}% completado`}
          </p>
        </div>
        <button
          className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-primary bg-primary px-4 font-body-sm text-body-sm font-semibold text-on-primary hover:bg-primary/90 active:scale-[0.98]"
          onClick={() =>
            onPlayPomodoro(firstTask?.id, block.projectId ?? undefined)
          }
          type="button"
        >
          <Play size={15} /> Enfoque
        </button>
      </div>

      {tasks.length > 0 && (
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary-fixed/60"
          role="progressbar"
          aria-label="Tareas del bloque completadas"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={taskProgress}
        >
          <div
            className="h-full rounded-full bg-secondary transition-[width] duration-500"
            style={{ width: `${taskProgress}%` }}
          />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="pt-1.5">
          <p className="flex items-center gap-1.5 py-1 font-label-caps text-label-caps text-on-surface-variant">
            <ListChecks size={13} />
            TAREAS DEL BLOQUE ({tasks.length})
          </p>
          <ul className="flex flex-col divide-y divide-outline-variant">
            {visibleTasks.map((task) => (
              <li className="flex items-center gap-2 py-1.5" key={task.id}>
                <button
                  aria-label={`Completar ${task.title}`}
                  className="shrink-0 rounded-md p-1 text-outline hover:bg-surface-container-low hover:text-primary"
                  onClick={() => onToggleTask(task)}
                  type="button"
                >
                  {task.status === "COMPLETED" ? (
                    <CheckCircle2 className="text-primary" size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>
                <Link
                  className="line-clamp-1 min-w-0 flex-1 font-body-sm text-body-sm font-medium hover:text-primary"
                  href={`/tasks?taskId=${encodeURIComponent(task.id)}`}
                >
                  {task.title}
                </Link>
                {task.id === nextTask?.id && task.status !== "COMPLETED" && (
                  <span className="shrink-0 rounded-md border border-primary px-1.5 py-0.5 font-label-caps text-label-caps text-[10px] uppercase text-primary">
                    Siguiente
                  </span>
                )}
                <PriorityChip priority={task.priority} />
                {dueBadge(task)}
              </li>
            ))}
          </ul>
          {remainingTasks > 0 && (
            <Link
              className="mt-1 inline-flex items-center gap-1 font-label-caps text-label-caps text-primary hover:underline"
              href="/tasks"
            >
              Ver {remainingTasks} más en Tareas
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-outline-variant pt-3">
        <Link
          className="font-label-caps text-label-caps text-primary hover:underline"
          href="/timeblocks"
        >
          VER AGENDA
        </Link>
      </div>
    </div>
  );
}
