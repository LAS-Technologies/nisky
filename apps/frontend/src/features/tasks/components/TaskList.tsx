"use client";

import { Plus, Sparkles } from "lucide-react";
import type { Task } from "@/types/entities";
import { dateKey } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { TaskCardShell } from "./TaskCard";

function dayLabel(day: Date) {
  return day.toLocaleDateString("es", { day: "numeric", month: "long" });
}

export function TaskList({
  tasks,
  onOpen,
  previewedTaskId,
  onToggle,
  onStartPomodoro,
  onPostponeToday,
  onCreateOnDay,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  previewedTaskId?: string | null;
  onToggle: (task: Task) => void;
  onStartPomodoro: (task: Task) => void;
  onPostponeToday?: (task: Task) => void;
  onCreateOnDay: (dateKey: string) => void;
}) {
  const today = dateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateKey(tomorrowDate);
  const visibleTasks = tasks;

  const datedTasks = visibleTasks.filter((task) => task.dueDate);
  const overdueTasks = datedTasks
    .filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED")
    .filter((task) => dateKey(task.dueDate!) < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.order - b.order);
  const overdueIds = new Set(overdueTasks.map((task) => task.id));
  const dateGroupedTasks = datedTasks
    .filter((task) => !overdueIds.has(task.id))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.order - b.order);
  const todayDatedTasks = dateGroupedTasks.filter((task) => dateKey(task.dueDate!) === today);
  const todayTasks = todayDatedTasks;
  const dayKeys = [
    ...(todayTasks.length > 0 ? [today] : []),
    ...Array.from(new Set(dateGroupedTasks.map((task) => dateKey(task.dueDate!)))).filter((key) => key !== today),
  ];

  if (datedTasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest p-10 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-secondary">
            <Sparkles aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              No hay tareas en la lista
            </p>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Todo al día. Puedes crear una tarea nueva o revisar las tareas sin fecha límite.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {overdueTasks.length > 0 && (
        <section className="tasks-group">
          <header className="tasks-group-heading">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-error">
                Atrasadas
              </span>
              <span className="rounded-full bg-error-container px-2 py-0.5 font-label-sm text-label-sm text-on-error-container">
                {overdueTasks.length}
              </span>
            </div>
          </header>
          <div className="flex flex-col gap-2">
            {overdueTasks.map((task) => (
              <TaskCardShell
                key={task.id}
                onOpen={() => onOpen(task)}
                onPostponeToday={onPostponeToday ? () => onPostponeToday(task) : undefined}
                onStartPomodoro={() => onStartPomodoro(task)}
                onToggle={() => onToggle(task)}
                isPreviewed={previewedTaskId === task.id}
                task={task}
              />
            ))}
          </div>
        </section>
      )}
      {dayKeys.map((key) => {
        const dayTasks = key === today
          ? todayTasks
          : dateGroupedTasks.filter((task) => dateKey(task.dueDate!) === key);
        const day = new Date(`${key}T00:00:00`);
        const isToday = key === today;
        return (
          <section className="tasks-group" data-day-key={key} key={key}>
            <header className="tasks-group-heading">
              <div className="flex items-center gap-2">
                <span className={cn("font-label-sm text-label-sm font-semibold uppercase tracking-wider", isToday ? "text-secondary" : "text-on-surface-variant")}>
                  {isToday ? `Hoy · ${dayLabel(day)}` : `${key === tomorrow ? "Mañana" : day.toLocaleDateString("es", { weekday: "long" })} · ${dayLabel(day)}`}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 font-label-sm text-label-sm", isToday ? "bg-surface-container-high text-secondary" : "bg-surface-container text-on-surface-variant")}>
                  {dayTasks.length}
                </span>
              </div>
              <button
                aria-label={`Crear tarea para ${dayLabel(day)}`}
                className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                onClick={() => onCreateOnDay(key)}
                type="button"
              >
                <Plus size={15} />
              </button>
            </header>
            <div className="flex flex-col gap-2">
              {dayTasks.map((task) => (
                <TaskCardShell
                key={task.id}
                onOpen={() => onOpen(task)}
                onStartPomodoro={() => onStartPomodoro(task)}
                onToggle={() => onToggle(task)}
                isPreviewed={previewedTaskId === task.id}
                task={task}
              />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
