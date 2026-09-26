"use client";

import { Check, Circle, Plus, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import type { TaskUpdatePayload } from "@/features/tasks/api/tasks";
import { TaskPagination } from "@/features/tasks/components/TaskPagination";
import type { PaginationMeta, ProjectMember, Task, TaskPriority } from "@/types/entities";
import { ProjectTaskRow } from "./ProjectTaskRow";

export type ProjectTaskMode = "ACTIVE" | "MINE" | "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

export function ProjectTaskWorkspace({
  tasks,
  members,
  meta,
  isLoading,
  isError,
  isFetching,
  mode,
   search,
   priority,
   assigneeId,
   dueFrom,
   dueTo,
   onModeChange,
   onSearchChange,
   onPriorityChange,
   onAssigneeChange,
   onDueFromChange,
   onDueToChange,
  onResetFilters,
  onRetry,
  onOpen,
  previewedTaskId,
  canEditTasks,
  onToggle,
  onUpdateTask,
  onStartPomodoro,
  onPageChange,
  onQuickAdd,
}: {
  tasks: Task[];
  members: ProjectMember[];
  meta?: PaginationMeta;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  mode: ProjectTaskMode;
  search: string;
  priority: TaskPriority | "ALL";
  assigneeId: string;
  dueFrom: string;
  dueTo: string;
  onModeChange: (mode: ProjectTaskMode) => void;
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: TaskPriority | "ALL") => void;
  onAssigneeChange: (value: string) => void;
  onDueFromChange: (value: string) => void;
  onDueToChange: (value: string) => void;
  onResetFilters: () => void;
  onRetry: () => void;
  onOpen: (task: Task) => void;
  previewedTaskId?: string | null;
  canEditTasks: boolean;
  onToggle: (task: Task) => void;
  onUpdateTask: (taskId: string, payload: TaskUpdatePayload) => Promise<void>;
  onStartPomodoro: (task: Task) => void;
  onPageChange: (page: number) => void;
  onCreateTask: () => void;
  onQuickAdd: (title: string) => Promise<void>;
}) {
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const hasAdvancedFilters = priority !== "ALL" || Boolean(assigneeId) || Boolean(dueFrom) || Boolean(dueTo);
  const submitQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    try {
      await onQuickAdd(title);
      setQuickTitle("");
      requestAnimationFrame(() => quickAddRef.current?.focus());
    } catch {
      // The mutation handler already reports the error and keeps the draft visible.
    }
  };

  return <section className="project-task-layout">
    <div className="project-tabs" role="group" aria-label="Estado de tareas">
      {(["ALL","PENDING","IN_PROGRESS","COMPLETED","MINE","ACTIVE"] as const).map(value => <button className="project-button" aria-pressed={mode === value} key={value} onClick={() => onModeChange(value)}>{{ALL:"Todas",PENDING:"Pendientes",IN_PROGRESS:"En curso",COMPLETED:"Completadas",MINE:"Mis tareas",ACTIVE:"Activas"}[value]}</button>)}
      {isFetching && <span className="project-small self-center">Actualizando…</span>}
    </div>
    <aside className="project-panel project-card project-task-filters">
      <h2>Trabaja con intención</h2><p className="project-small mb-4">Filtra por persona o estado para encontrar tu siguiente paso.</p>
      <label className="project-small block mb-4">Responsable<select className="project-input mt-2" aria-label="Filtrar por asignado" value={assigneeId} onChange={e => onAssigneeChange(e.target.value)}><option value="">Todas las personas</option><option value="__unassigned__">Sin asignar</option>{members.map(m => <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>)}</select></label>
      <label className="project-small block">Prioridad<select className="project-input mt-2" aria-label="Filtrar por prioridad" value={priority} onChange={e => onPriorityChange(e.target.value as TaskPriority | "ALL")}><option value="ALL">Todas</option><option value="URGENT">Urgente</option><option value="HIGH">Alta</option><option value="NORMAL">Normal</option><option value="LOW">Baja</option></select></label>
      <details className="mt-5"><summary className="project-small cursor-pointer">Buscar y filtrar por fecha</summary><div className="project-stack mt-4">
        <input className="project-input" aria-label="Buscar tareas del proyecto" type="search" placeholder="Buscar tareas…" value={search} onChange={e => onSearchChange(e.target.value)} />
        <label className="project-small">Entrega desde<input className="project-input mt-2" aria-label="Filtrar entrega desde" type="date" max={dueTo || undefined} value={dueFrom} onChange={e => onDueFromChange(e.target.value)} /></label>
        <label className="project-small">Entrega hasta<input className="project-input mt-2" aria-label="Filtrar entrega hasta" type="date" min={dueFrom || undefined} value={dueTo} onChange={e => onDueToChange(e.target.value)} /></label>
      </div></details>
      {(hasAdvancedFilters || search || mode !== "ALL") && <button className="project-button mt-4" onClick={onResetFilters}>Limpiar filtros</button>}
    </aside>
    <div className="project-panel project-card project-task-list">
      <h2>Tareas del proyecto</h2>
      {isLoading ? <TaskSkeleton /> : isError ? <TaskError onRetry={onRetry} /> : tasks.length === 0 ? <TaskEmpty hasFilters={mode !== "ALL" || Boolean(search) || hasAdvancedFilters} mode={mode} onReset={onResetFilters} /> : <>
        {tasks.map(task => <ProjectTaskRow key={task.id} canEditTasks={canEditTasks} isPreviewed={previewedTaskId === task.id} members={members} onOpen={() => onOpen(task)} onStartPomodoro={() => onStartPomodoro(task)} onToggle={onToggle} onUpdateTask={onUpdateTask} task={task} />)}
        {meta && <TaskPagination isFetching={isFetching} meta={meta} onPageChange={onPageChange} />}
      </>}
      {canEditTasks && <details className="mt-4"><summary className="project-small cursor-pointer">Añadir una tarea rápida</summary><QuickAddInput inputRef={quickAddRef} onChange={setQuickTitle} onSubmit={() => void submitQuickAdd()} value={quickTitle} /></details>}
    </div>
  </section>;
}

function QuickAddInput({ inputRef, value, onChange, onSubmit }: { inputRef: React.RefObject<HTMLInputElement | null>; value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return <form className="flex items-center gap-2 rounded-b-lg border-t border-[#e7e9e8] bg-[#fafaf8] px-3 py-2.5 sm:px-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7e9e8] text-[#1e3a5f]"><Plus size={15} /></span><input aria-label="Añadir tarea rápida" className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-[#2f3b45] outline-none placeholder:text-[#9aa2a5]" onChange={(event) => onChange(event.target.value)} placeholder="Añadir una tarea rápida..." ref={inputRef} value={value} /><button aria-label="Crear tarea rápida" className="flex h-9 w-9 items-center justify-center rounded-md text-[#1e3a5f] hover:bg-[#e7e9e8] disabled:opacity-40" disabled={!value.trim()} type="submit"><Check size={16} /></button></form>;
}

function TaskSkeleton() {
   return <div className="divide-y divide-[#e7e9e8]">{[0, 1, 2, 3].map((row) => <div className="flex h-[4.25rem] items-center gap-3 px-4" key={row}><span className="h-5 w-5 animate-pulse rounded-full bg-[#e7e9e8]" /><span className="h-3 w-1/2 animate-pulse rounded-sm bg-[#e7e9e8]" /></div>)}</div>;
}

function TaskError({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center"><RefreshCw className="text-[#c73b52]" size={22} /><p className="text-[13px] text-[#5f6872]">No pudimos cargar las tareas del proyecto.</p><button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dde1e2] px-3 text-[13px] font-semibold text-[#1e3a5f] hover:bg-[#eff1f0]" onClick={onRetry} type="button"><RefreshCw size={14} /> Reintentar</button></div>;
}

function TaskEmpty({ hasFilters, mode, onReset }: { hasFilters: boolean; mode: ProjectTaskMode; onReset: () => void }) {
  const title = hasFilters ? "No hay tareas con estos filtros." : mode === "ACTIVE" ? "No hay tareas activas en este proyecto." : mode === "MINE" ? "No tienes tareas asignadas." : "Todavía no hay tareas en este proyecto.";
  const description = hasFilters ? "Prueba otra combinación o limpia los filtros." : mode === "ACTIVE" ? "Las tareas completadas siguen disponibles en Todas." : mode === "MINE" ? "Crea una tarea o revisa la vista Todas." : "Crea la primera tarea desde la entrada rápida.";
  return <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center"><Circle className="text-[#1e3a5f]" size={23} /><p className="mt-1 text-[13px] font-medium text-[#2f3b45]">{title}</p><p className="text-[12px] text-[#5f6872]">{description}</p>{hasFilters && <button className="mt-2 rounded-lg border border-[#dde1e2] px-3 py-2 text-[12px] font-semibold text-[#1e3a5f] hover:bg-[#eff1f0]" onClick={onReset} type="button">Limpiar filtros</button>}</div>;
}
