"use client";

import { Activity } from "lucide-react";
import type { ProjectActivity } from "@/types/entities";
import { localDateKey } from "@/lib/utils";

const labels: Record<string, string> = {
  PROJECT_CREATED: "creó el proyecto",
  PROJECT_UPDATED: "actualizó el proyecto",
  TASK_CREATED: "creó la tarea",
  TASK_UPDATED: "actualizó la tarea",
  TASK_COMPLETED: "completó la tarea",
  TASK_DELETED: "eliminó la tarea",
  SUBTASK_CREATED: "añadió una subtarea",
  SUBTASK_UPDATED: "actualizó una subtarea",
  SUBTASK_DELETED: "eliminó una subtarea",
  NOTE_CREATED: "creó la nota",
  NOTE_UPDATED: "actualizó la nota",
  NOTE_DELETED: "eliminó la nota",
  MEMBER_ADDED: "añadió a un miembro",
  MEMBER_REMOVED: "eliminó a un miembro",
  MEMBER_ROLE_CHANGED: "cambió un rol",
  COMMENT_CREATED: "comentó en el proyecto",
  RESOURCE_ADDED: "añadió un recurso",
  RESOURCE_DELETED: "eliminó un recurso",
};

function category(type: string) {
  if (type.startsWith("TASK") || type.startsWith("SUBTASK")) return "Tarea";
  if (type.startsWith("NOTE")) return "Nota";
  if (type.startsWith("MEMBER")) return "Equipo";
  if (type.startsWith("COMMENT")) return "Conversación";
  if (type.startsWith("RESOURCE")) return "Recurso";
  return "Proyecto";
}

export function ProjectActivityTimeline({ activities }: { activities: ProjectActivity[] }) {
  if (!activities.length) return <div className="flex min-h-56 flex-col items-center justify-center gap-3"><Activity size={24} /><p className="project-muted">Aún no hay actividad.</p></div>;
  const groups = new Map<string, ProjectActivity[]>();
  for (const item of activities) { const day = localDateKey(item.createdAt); groups.set(day, [...(groups.get(day) ?? []), item]); }
  return <div>{[...groups].map(([day,items]) => <section key={day} className="border-b border-outline-variant last:border-0 py-3">
    <p className="project-eyebrow">{new Date(day+"T12:00:00").toLocaleDateString("es",{weekday:"long",day:"numeric",month:"long"})}</p>
    {items.map(item => <article className="project-row" key={item.id}><p>{item.actor.name ?? item.actor.email} {labels[item.type] ?? "hizo un cambio"}{item.entityTitle ? ` «${item.entityTitle}»` : ""}<small>{new Date(item.createdAt).toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})} · {category(item.type)} del proyecto</small></p><span>{item.type === "TASK_COMPLETED" ? "Completada" : category(item.type)}</span></article>)}
  </section>)}</div>;
}
