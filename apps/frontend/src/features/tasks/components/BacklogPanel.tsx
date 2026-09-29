"use client";

import type { Task } from "@/types/entities";
import { TaskCardShell } from "./TaskCard";

export function BacklogPanel({
  tasks,
  count,
  onOpen,
  previewedTaskId,
  onToggle,
  onStartPomodoro,
}: {
  tasks: Task[];
  count: number;
  onOpen: (task: Task) => void;
  previewedTaskId?: string | null;
  onToggle: (task: Task) => void;
  onStartPomodoro: (task: Task) => void;
}) {
  return (
    <section className="tasks-group tasks-backlog">
      <header className="tasks-group-heading">
        <div>
          <h2 className="font-headline-xs text-headline-xs font-semibold text-on-surface">
            Por planificar
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Tareas que todavía no tienen fecha límite.
          </p>
        </div>
        <span className="font-data-mono text-data-mono text-[11px] text-on-surface-variant">
          {count} {count === 1 ? "tarea" : "tareas"}
        </span>
      </header>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
          <p className="font-headline-xs text-headline-xs font-semibold text-on-surface">
            No hay tareas sin fecha límite
          </p>
            <p className="mt-1 max-w-sm font-body-sm text-body-sm text-on-surface-variant">
              Las tareas nuevas sin fecha límite aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
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
      )}
      <p className="tasks-backlog-footer tasks-muted">Estas tareas seguirán aquí hasta que decidas una fecha límite.</p>
    </section>
  );
}
