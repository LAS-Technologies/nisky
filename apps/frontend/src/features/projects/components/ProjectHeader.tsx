"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Project } from "@/types/entities";

export function ProjectHeader({ project, canEdit, canDelete, onEdit, onDelete, subtitle, action }: {
  project: Project; canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void; subtitle: string; action?: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  return <header className="project-page-header">
    <div><Link className="project-eyebrow" href="/projects">PROYECTOS</Link><h1>{project.name}</h1><p>{subtitle}</p></div>
    <div className="project-actions">
      {action}
      <div className="relative">
        <button className="project-button" aria-label="Más acciones del proyecto" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>···</button>
        {moreOpen && <>
          <button className="fixed inset-0 z-20" aria-label="Cerrar acciones" onClick={() => setMoreOpen(false)} />
          <div className="project-panel absolute right-0 top-full z-30 mt-2 w-56 p-2" onKeyDown={e => { if (e.key === "Escape") setMoreOpen(false); }}>
            <Link className="project-row" href={`/tasks?projectId=${encodeURIComponent(project.id)}`}>Planificación global</Link>
            {canEdit && <button className="project-row" onClick={() => { setMoreOpen(false); onEdit(); }}>Editar proyecto</button>}
            {canDelete && <button className="project-row text-error" onClick={() => { setMoreOpen(false); onDelete(); }}>Eliminar proyecto</button>}
          </div>
        </>}
      </div>
    </div>
  </header>;
}
