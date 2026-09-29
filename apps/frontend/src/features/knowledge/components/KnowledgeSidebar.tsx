"use client";
import type { KnowledgeFacets, Project } from "@/types/entities";

export type KnowledgeFilter =
  | { type: "category" | "tag"; name: string }
  | { type: "project"; id: string | null; name: string }
  | { type: "pinned" }
  | null;

export function KnowledgeSidebar({ facets, projects = [], active, onFilter }: {
  facets: KnowledgeFacets | undefined; projects?: Project[]; active: KnowledgeFilter; onFilter: (filter: KnowledgeFilter) => void;
}) {
  return <aside className="official-panel space-y-5">
    <h2>Explorar</h2>
    <nav aria-label="Explorar notas" className="flex flex-col gap-3">
      <button className="official-button justify-start" aria-pressed={!active} onClick={() => onFilter(null)}>Todas las notas</button>
      <button className="official-button justify-start" aria-pressed={active?.type === "pinned"} onClick={() => onFilter({ type: "pinned" })}>Fijadas</button>
      <button className="official-button justify-start" aria-pressed={active?.type === "project" && active.id === null} onClick={() => onFilter({ type: "project", id: null, name: "Personal" })}>Personal</button>
      {projects.map(project => <button key={project.id} className="official-button justify-start min-w-0" aria-pressed={active?.type === "project" && active.id === project.id} onClick={() => onFilter({ type: "project", id: project.id, name: project.name })}><span className="truncate">{project.name}</span></button>)}
    </nav>
    {!!facets?.categories.length && <div className="border-t border-outline-variant pt-4"><h3 className="official-eyebrow mb-3">Categorías</h3>{facets.categories.map(item => <button key={item.name} className="official-button mb-2 w-full justify-between" aria-pressed={active?.type === "category" && active.name === item.name} onClick={() => onFilter({ type: "category", name: item.name })}><span className="truncate">{item.name}</span><span>{item.count}</span></button>)}</div>}
    <div className="border-t border-outline-variant pt-4"><h3 className="official-eyebrow mb-3">Etiquetas</h3><div className="flex flex-wrap gap-2">{facets?.tags.map(item => <button key={item.name} className="rounded-lg bg-primary-fixed px-3 py-2 text-xs text-primary" aria-pressed={active?.type === "tag" && active.name === item.name} onClick={() => onFilter({ type: "tag", name: item.name })}>{item.name}</button>)}</div></div>
    {active && <button className="text-sm text-primary underline" onClick={() => onFilter(null)}>Limpiar filtros</button>}
  </aside>;
}
