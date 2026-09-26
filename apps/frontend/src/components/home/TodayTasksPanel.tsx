"use client";

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Folder,
  MoreHorizontal,
  SquareCheck,
} from "lucide-react";
import Link from "next/link";
import { HomeCardHeader } from "./HomeCardHeader";
import { localDateKey } from "@/lib/utils";
import type { HomeBlockTask, Task } from "@/types/entities";

const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const;

export function getTodayUrgentTasks(tasks: Task[], limit = 5) {
  const todayKey = localDateKey(new Date());
  const byPriority = (a: Task, b: Task) =>
    priorityRank[a.priority] - priorityRank[b.priority];
  const overdue = tasks
    .filter(
      (task) =>
        task.status === "PENDING" &&
        task.dueDate &&
        localDateKey(task.dueDate) < todayKey,
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const today = tasks
    .filter(
      (task) =>
        task.status === "PENDING" &&
        task.dueDate &&
        localDateKey(task.dueDate) === todayKey,
    )
    .sort(byPriority);
  const highNoDate = tasks
    .filter(
      (task) =>
        task.status === "PENDING" && !task.dueDate && task.priority === "HIGH",
    )
    .sort(byPriority);
  return [...overdue, ...today, ...highNoDate].slice(0, limit);
}

function dueBadge(task: Task) {
  const todayKey = localDateKey(new Date());
  const overdue = task.dueDate && localDateKey(task.dueDate) < todayKey;
  const today = task.dueDate && localDateKey(task.dueDate) === todayKey;
  if (!task.dueDate) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[13px] ${overdue ? "text-error" : "text-primary"}`}
    >
      {overdue ? <AlertCircle size={12} /> : <CalendarDays size={12} />}
      {overdue ? "Atrasada" : today ? "Hoy" : localDateKey(task.dueDate)}
    </span>
  );
}

function priorityBadge(task: Task) {
  if (task.dueDate || (task.priority !== "HIGH" && task.priority !== "URGENT")) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-warning-container px-2 py-0.5 font-data-mono text-[11px] font-medium text-on-warning-container">
      {task.priority === "URGENT" ? "Urgente" : "Alta"}
    </span>
  );
}

function TodayTaskRow({ task, onToggle }: { task: Task | HomeBlockTask; onToggle: (task: Task) => void }) {
  const completed = task.status === "COMPLETED";
  return (
    <div className="home-task-row">
      <button aria-label={`${completed ? "Marcar pendiente" : "Completar"} ${task.title}`} aria-pressed={completed} className="home-check-button" onClick={() => onToggle(task)} type="button">
        <span className="home-checkbox" data-checked={completed}><Check size={14} aria-hidden="true" /></span>
      </button>
      <Link className={`home-task-name hover:text-primary ${completed ? "text-on-surface-variant line-through" : ""}`} href={`/tasks?taskId=${encodeURIComponent(task.id)}`}>
        {task.title}
        {"scheduleState" in task && task.scheduleState === "REPLAN" && <span className="ml-2 text-xs text-error">Replanificar</span>}
        {(task.commentCount ?? 0) > 0 && <span className="sr-only"> · {task.commentCount} comentarios</span>}
      </Link>
      {task.project && (
        <Link className="home-task-project" href={`/projects/${encodeURIComponent(task.project.id)}`} title={task.project.name}>
          <Folder size={14} className="shrink-0" aria-hidden="true" /><span className="truncate">{task.project.name}</span>
        </Link>
      )}
      <span className="home-task-due">{dueBadge(task) ?? priorityBadge(task)}</span>
      <Link aria-label={`Ver detalles de ${task.title}`} className="home-icon-action" href={`/tasks?taskId=${encodeURIComponent(task.id)}`}><MoreHorizontal size={18} /></Link>
    </div>
  );
}

export function TodayTasksPanel({ tasks, blockTasks = [], onToggle, emptyMessage = "Nada pendiente. ¡Todo al día!", onCreateTask }: {
  tasks: Task[];
  blockTasks?: HomeBlockTask[];
  onToggle: (task: Task) => void;
  emptyMessage?: string;
  onCreateTask?: () => void;
}) {
  const allTasks = [...blockTasks, ...tasks];
  return (
    <section className="home-card home-tasks" aria-label="Por hacer">
      <HomeCardHeader icon={SquareCheck} title="Por hacer" count={`${allTasks.length} tareas`} action={
        <Link className="flex min-h-11 shrink-0 items-center gap-1 text-[13px] text-primary hover:underline" href="/tasks">Ver todas <ArrowRight size={14} aria-hidden="true" /></Link>
      } />
      {allTasks.length === 0 ? (
        <div className="flex min-h-[204px] flex-col items-start justify-center gap-3">
          <p className="font-headline-sm text-headline-sm font-bold">Un paso a la vez</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{emptyMessage}</p>
          {onCreateTask && <button className="min-h-11 rounded-sm bg-primary px-4 font-body-sm text-body-sm text-on-primary hover:bg-primary-container" onClick={onCreateTask} type="button">Añadir una tarea</button>}
        </div>
      ) : (
        <div className="home-task-list">
          {allTasks.map((task) => <TodayTaskRow key={task.id} onToggle={onToggle} task={task} />)}
        </div>
      )}
    </section>
  );
}
