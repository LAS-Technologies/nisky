"use client";
import Link from "next/link";
import { AvatarStack } from "@/components/ui/Avatar";
import { useTodayBlocksQuery } from "@/features/timeblocks/hooks/useTimeBlocks";
import { minToTime } from "@/features/timeblocks/lib/time";
import { formatDateTime } from "@/lib/utils";
import type { ProjectSummary, Task } from "@/types/entities";

export function ProjectOverview({ summary, onOpenTasks, onOpenTask, isError, onRetry }: { summary: ProjectSummary | null; onOpenTasks: () => void; onOpenTask: (task: Task) => void; isError?: boolean; onRetry?: () => void }) {
  const blocks = useTodayBlocksQuery();
  if (isError && !summary) return <div className="project-panel project-card project-stack" role="alert"><p>No pudimos cargar el resumen del proyecto.</p><button className="project-button" onClick={onRetry}>Reintentar</button></div>;
  if (!summary) return <div className="project-panel h-72 animate-pulse" role="status" aria-label="Cargando resumen" />;
  const {project, members, counts} = summary;
  const goal = project.weeklyTargetMinutes;
  const now = new Date();
  const next = blocks.data?.filter(b => b.projectId === project.id && b.startMin > now.getHours()*60+now.getMinutes()).sort((a,b) => a.startMin-b.startMin)[0];
  const owner = members.find(m => m.role === "OWNER");
  return <div className="project-stack">
    <div className="project-grid">
      <div className="project-panel project-stat"><strong>{counts.completed} / {summary.totalTasks}</strong><p className="project-small">Tareas completadas</p></div>
      <div className="project-panel project-stat"><strong>{goal ? `${Math.floor(goal/60)} h ${goal%60} min` : "Sin meta"}</strong><p className="project-small">Meta semanal de enfoque</p></div>
      <div className="project-panel project-stat"><strong>{project.targetDate ? new Date(project.targetDate.slice(0,10)+"T12:00:00").toLocaleDateString("es",{day:"numeric",month:"short"}) : "Sin fecha"}</strong><p className="project-small">Fecha objetivo</p></div>
    </div>
    <div className="project-split">
      <section className="project-panel project-card min-h-[340px]">
        <div className="flex items-center justify-between gap-3"><h2>Próximos pasos</h2><button className="text-primary text-[13px]" onClick={onOpenTasks}>Ver todas</button></div>
        {counts.overdue > 0 && <button className="mb-3 text-error text-[13px]" onClick={onOpenTasks}>{counts.overdue} tareas vencidas · Revisar</button>}
        {summary.upcomingTasks.length === 0 ? <p className="project-muted">No hay acciones con fecha próxima.</p> : summary.upcomingTasks.slice(0,3).map(task => <button key={task.id} className="project-row" onClick={() => onOpenTask(task)}><span>{task.title}<small>{task.dueDate ? formatDateTime(task.dueDate) : "Sin fecha"} · {task.assignee?.name ?? "Sin asignar"}</small></span><span>{task.status === "IN_PROGRESS" ? "En curso" : task.status === "COMPLETED" ? "Completada" : "Pendiente"}</span></button>)}
      </section>
      <aside className="project-stack">
        <section className="project-panel project-card min-h-[268px]"><h2>Contexto del proyecto</h2><p className="project-muted mb-4">{project.description || "Este proyecto todavía no tiene descripción."}</p><div className="flex items-center gap-2 mb-4"><AvatarStack members={members} max={3} size="sm" /><span className="project-tag">{members.length} personas</span></div><p className="project-small">Propietario · {owner?.user.name ?? owner?.user.email ?? "—"}</p></section>
        <section className="project-panel project-card"><h2>Tu próxima sesión de hoy</h2>{blocks.isError ? <button className="project-button" onClick={() => void blocks.refetch()}>Reintentar agenda</button> : blocks.isPending ? <p className="project-small">Cargando agenda…</p> : next ? <><p className="font-semibold mb-3">{next.name || project.name}</p><p className="project-small mb-4">Hoy · {minToTime(next.startMin)}–{minToTime(next.endMin)}</p></> : <p className="project-muted mb-4">Reserva un espacio para avanzar en este proyecto.</p>}<Link className="project-button" href="/timeblocks">Ir a Agenda</Link></section>
      </aside>
    </div>
  </div>;
}
