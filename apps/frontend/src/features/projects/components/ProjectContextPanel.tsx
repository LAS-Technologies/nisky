"use client";

import { CalendarDays, Clock3, RefreshCw, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { ProjectSummary, Task } from "@/types/entities";
import { cn, formatRelativeDate, isLegacyNoonDate, isTaskOverdue, localDateKey } from "@/lib/utils";

function groupUpcomingTasks(tasks: Task[]) {
  const groups = new Map<string, { label: string; tasks: Task[] }>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = localDateKey(task.dueDate);
    const group = groups.get(key) ?? { label: formatRelativeDate(task.dueDate), tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function taskTimeLabel(task: Task) {
  if (!task.dueDate || isLegacyNoonDate(task.dueDate)) return "Durante el día";
  const date = new Date(task.dueDate);
  if (date.getHours() === 23 && date.getMinutes() === 59) return "Durante el día";
  return `Vence a las ${date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export function ProjectContextPanel({ summary, onOpenTask, showProgress = true, showUpcomingDates = true, isError = false, onRetry }: { summary: ProjectSummary | null; onOpenTask: (task: Task) => void; showProgress?: boolean; showUpcomingDates?: boolean; isError?: boolean; onRetry?: () => void }) {
  if (isError && !summary) return <ContextError onRetry={onRetry} />;
  if (!summary) return <ContextSkeleton />;
  const upcomingGroups = groupUpcomingTasks(summary.upcomingTasks);
  return (
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
      {showProgress && <ProjectProgressCard summary={summary} />}

      {showUpcomingDates && <section className="project-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="project-eyebrow">CALENDARIO</p>
             <h2 className="mt-1 text-[16px] font-semibold text-[#1f2933]">Próximas fechas</h2>
          </div>
           <CalendarDays className="text-[#778186]" size={17} />
        </div>
          <div className="mt-4">
           {summary.upcomingTasks.length === 0 ? (
              <p className="py-3 text-[13px] text-[#5f6872]">No hay tareas con fecha próxima.</p>
           ) : upcomingGroups.map((group) => (
             <div className="border-t border-[#e7e9e8] first:border-t-0" key={group.label}>
               <div className="flex items-center justify-between gap-3 px-2 py-2.5">
                 <span className="text-[12px] font-semibold capitalize text-[#1e3a5f]">{group.label}</span>
                 <span className="text-[11px] text-[#778186]">{group.tasks.length} {group.tasks.length === 1 ? "tarea" : "tareas"}</span>
               </div>
               <div className="divide-y divide-[#e7e9e8]">
                 {group.tasks.map((task) => (
                   <button className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-[#eff1f0] hover:text-[#1e3a5f]" key={task.id} onClick={() => onOpenTask(task)} type="button">
                     <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", isTaskOverdue(task) ? "bg-[#fff1f3] text-[#c73b52]" : "bg-[#e7e9e8] text-[#1e3a5f]")}>
                       <Clock3 size={14} />
                     </span>
                     <span className="min-w-0 flex-1">
                       <span className="block truncate text-[13px] font-medium text-[#2f3b45]">{task.title}</span>
                       <span className={cn("mt-0.5 block text-[11px]", isTaskOverdue(task) ? "text-[#c73b52]" : "text-[#5f6872]")}>{taskTimeLabel(task)}</span>
                     </span>
                   </button>
                 ))}
               </div>
             </div>
           ))}
         </div>
      </section>}

      <section className="project-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="project-eyebrow">COLABORACIÓN</p>
            <h2 className="mt-1 text-[16px] font-semibold text-[#1f2933]">Equipo</h2>
            <p className="mt-0.5 text-[11px] text-[#778186]">Pendientes asignadas por miembro</p>
          </div>
          <Users className="text-[#778186]" size={17} />
        </div>
        <div className="mt-4 space-y-3">
          {summary.taskCountsByMember.map((member) => (
            <div className="flex items-center gap-2.5" key={member.userId}>
              <Avatar avatarUrl={member.user.avatarUrl} email={member.user.email} name={member.user.name} size="sm" />
               <span className="min-w-0 flex-1 truncate text-[13px] text-[#4f5a63]">{member.user.name ?? member.user.email}</span>
               <span className="shrink-0 text-[12px] text-[#5f6872]">{member.count}</span>
            </div>
          ))}
           {summary.taskCountsByMember.length === 0 && <p className="text-[13px] text-[#5f6872]">Solo tú trabajas en este proyecto.</p>}
        </div>
      </section>
    </aside>
  );
}

export function ProjectProgressCard({ summary }: { summary: ProjectSummary }) {
  const progress = Math.min(100, Math.max(0, summary.progress));
  return (
    <section className="project-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="project-eyebrow">SEGUIMIENTO</p>
           <h2 className="mt-1 text-[17px] font-semibold text-[#1f2933]">Progreso del proyecto</h2>
        </div>
         <span className="font-data-mono text-[28px] font-bold tracking-[-0.04em] text-[#4a7c59]">{progress}%</span>
      </div>
       <div aria-label={`${progress}% completado`} className="mt-6 h-2.5 overflow-hidden rounded-full bg-[#e7e9e8]" role="progressbar" aria-valuemax={100} aria-valuenow={progress}>
         <div className="h-full rounded-full bg-[#4a7c59] transition-[width]" style={{ width: `${progress}%` }} />
      </div>
       <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[#5f6872]">
        <span>{summary.counts.completed} de {summary.totalTasks} completadas</span>
        {summary.counts.overdue > 0 && <span className="font-semibold text-[#c73b52]">{summary.counts.overdue} vencidas</span>}
      </div>
    </section>
  );
}

function ContextSkeleton() {
  return (
    <aside className="space-y-4" aria-hidden="true">
      {[0, 1, 2].map((card) => <div className="project-panel h-40 animate-pulse bg-white/70" key={card} />)}
    </aside>
  );
}

export function ProjectProgressSummary({ summary, onOpenTask }: { summary: ProjectSummary | null; onOpenTask: (task: Task) => void }) {
  return <ProjectContextPanel onOpenTask={onOpenTask} summary={summary} />;
}

function ContextError({ onRetry }: { onRetry?: () => void }) {
  return (
    <aside className="project-panel flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center">
      <RefreshCw className="text-[#c73b52]" size={20} />
       <p className="text-[13px] text-[#5f6872]">No pudimos cargar el resumen.</p>
       {onRetry && <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#dde1e2] px-3 text-[12px] font-semibold text-[#1e3a5f] hover:bg-[#eff1f0]" onClick={onRetry} type="button"><RefreshCw size={14} /> Reintentar</button>}
    </aside>
  );
}
