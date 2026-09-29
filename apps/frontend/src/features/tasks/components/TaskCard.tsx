"use client";

import { CalendarDays, CheckSquare2, MessageSquare, Play, Square, Timer } from "lucide-react";
import type { Task } from "@/types/entities";
import { cn, isTaskOverdue } from "@/lib/utils";
import { PriorityChip } from "./PriorityChip";
import { formatTaskDueDate } from "../lib/task-utils";
import { useTaskSelection } from "../selection/TaskSelectionContext";

export function TaskCardShell({
  task,
  onOpen,
  isPreviewed = false,
  onToggle,
  onPostponeToday,
  onStartPomodoro,
}: {
  task: Task;
  onOpen: () => void;
  isPreviewed?: boolean;
  onToggle: () => void;
  onPostponeToday?: () => void;
  onStartPomodoro?: () => void;
}) {
  const completed = task.status === "COMPLETED";
  const overdue = isTaskOverdue(task);
  const subtaskTotal = task.subtaskCount ?? task.subtasks?.length ?? 0;
  const completedSubtasks = task.completedSubtasks ?? task.subtasks?.filter((subtask) => subtask.completed).length ?? 0;
  const selection = useTaskSelection();
  const isSelecting = selection.mode;
  const selected = selection.isSelected(task.id);
  return (
    <article
      aria-label={`Tarea: ${task.title}`}
      aria-selected={isSelecting ? selected : undefined}
      role="option"
      className={cn(
        "task-row group relative cursor-pointer rounded-xl border bg-surface-container-lowest p-4 transition-all",
        !overdue && "hover:border-outline",
        !overdue && "hover:-translate-y-px hover:shadow-md",
        isSelecting && "cursor-pointer",
         selected ? "border-2 border-primary bg-primary-fixed/20" : completed ? "border-outline-variant/60 opacity-60" : "border-outline-variant",
         isPreviewed && !selected && "border-2 border-primary bg-primary-fixed/20 shadow-md",
         isSelecting && !selected && "hover:border-primary/60",
         overdue && "border-l-4 border-l-error hover:border-l-error hover:shadow-md",
      )}
      data-task-card
      data-task-id={task.id}
      onClick={() => {
        if (isSelecting) selection.toggleSelect(task.id);
        else onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (isSelecting) selection.toggleSelect(task.id);
          else onOpen();
        }
      }}
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            aria-label={isSelecting ? (selected ? "Quitar selección" : "Seleccionar tarea") : completed ? "Marcar pendiente" : "Marcar completada"}
            className="task-row-check shrink-0 text-primary"
            onClick={(event) => {
              event.stopPropagation();
              if (isSelecting) selection.toggleSelect(task.id);
              else onToggle();
            }}
            type="button"
          >
            {isSelecting ? (selected ? <CheckSquare2 size={17} className="text-primary" /> : <Square size={17} />) : completed ? <CheckSquare2 size={22} /> : <Square size={22} />}
          </button>
          <button
             className="min-w-0 flex-1 rounded-md text-left"
            onClick={(event) => {
              event.stopPropagation();
              if (isSelecting) selection.toggleSelect(task.id);
              else onOpen();
            }}
            type="button"
          >
            <p
              className={`line-clamp-2 break-words font-body-md text-body-md font-medium leading-5 ${completed ? "line-through" : ""}`}
            >
              {task.title}
            </p>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isPreviewed && <span className="hidden rounded-md bg-primary-fixed px-2 py-1 font-label-caps text-[10px] font-semibold uppercase tracking-wide text-primary sm:inline-flex">Abierta en panel</span>}
        </div>
      </div>
      <div className="task-row-meta flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
           {task.project && (
             <span className="inline-flex min-w-0 max-w-[10rem] items-center gap-1.5 font-label-md text-[11px] leading-4 text-on-surface-variant" title={task.project.name}>
               <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />
               <span className="truncate">{task.project.name}</span>
             </span>
           )}
           {(task.priority === "URGENT" || task.priority === "HIGH") && (
             <PriorityChip priority={task.priority} />
           )}
           {!task.dueDate && !isSelecting && <button className="task-assign-date" onClick={event => { event.stopPropagation(); onOpen(); }} type="button">Asignar fecha</button>}
           {task.dueDate && (
             <time
               className={cn(
                "inline-flex items-center gap-1 font-label-md text-[11px] leading-4",
                overdue ? "font-semibold text-error" : "text-on-surface-variant",
              )}
              dateTime={task.dueDate}
              title={task.dueDate}
            >
               <CalendarDays className="shrink-0" size={12} />
                {formatTaskDueDate(task.dueDate)}
             </time>
           )}
         </div>
         <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] leading-4">
           {(task.commentCount ?? 0) > 0 && <span className="flex items-center gap-1 font-data-mono text-data-mono text-on-surface-variant" title="Comentarios"><MessageSquare size={12} /> {task.commentCount}</span>}
           {((task.pomodoroCount ?? 0) > 0 || (task.pomodoroEstimate ?? 0) > 0) && <span className="flex items-center gap-1 font-data-mono text-data-mono text-tertiary" title="Pomodoros"><Timer size={12} /> {task.pomodoroCount ?? 0}/{task.pomodoroEstimate ?? 0}</span>}
           {subtaskTotal > 0 && <span className="flex items-center gap-1 font-data-mono text-data-mono text-secondary" title="Subtareas"><CheckSquare2 size={12} /> {completedSubtasks}/{subtaskTotal}</span>}
            {overdue && onPostponeToday && !isSelecting && (
             <button
                className="inline-flex h-8 items-center rounded-lg border border-outline-variant bg-surface-container-low px-2.5 font-label-md text-label-md font-semibold text-on-surface hover:border-error/30 hover:bg-error-container hover:text-on-error-container"
               onClick={(event) => {
                 event.stopPropagation();
                 onPostponeToday();
              }}
              type="button"
            >
               Posponer a hoy
             </button>
           )}
           {onStartPomodoro && !isSelecting && <button aria-label={`Iniciar Pomodoro para ${task.title}`} className="flex shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface p-1 text-primary transition-opacity hover:border-primary hover:bg-primary-fixed sm:invisible sm:opacity-0 sm:group-focus-within:visible sm:group-focus-within:opacity-100 sm:group-hover:visible sm:group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); onStartPomodoro(); }} onPointerDown={(event) => event.stopPropagation()} title="Ir a Pomodoro" type="button"><Play size={13} /></button>}
        </div>
      </div>
    </article>
  );
}
