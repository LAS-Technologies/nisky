"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useAccessibleProjects, useProjectMutations } from "@/features/projects/hooks/useProjects";
import { ProjectFormDialog } from "@/features/projects/components/ProjectFormDialog";
import { ProjectWorkspaceShell } from "@/features/projects/components/ProjectWorkspaceShell";

type ProjectFilter = "ALL" | "OWNED" | "SHARED";

export default function ProjectsPage() {
  const { user } = useAuth();
  const query = useAccessibleProjects();
  const mutations = useProjectMutations();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("ALL");
  const [sort, setSort] = useState("recent");
  const projects = query.data ?? [];
  const filtered = projects.filter(p => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    .filter(p => filter === "ALL" || (filter === "OWNED" ? p.userId === user?.id : p.userId !== user?.id))
    .sort((a,b) => sort === "name" ? a.name.localeCompare(b.name, "es") : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const owned = filtered.filter(p => p.userId === user?.id);
  const shared = filtered.filter(p => p.userId !== user?.id);

  return (
    <ProjectWorkspaceShell>
      <header className="project-page-header">
        <div><p className="project-eyebrow">PROYECTOS</p><h1>Mis proyectos</h1><p>Un lugar para cada objetivo.</p></div>
        <button className="project-button" data-primary="true" onClick={() => setCreateOpen(true)}>Nuevo proyecto</button>
      </header>
      {projects.length > 0 && <>
        <div className="project-tabs" role="group" aria-label="Filtrar proyectos">
          {([["ALL","Todos"],["OWNED","Propios"],["SHARED","Compartidos"]] as const).map(([value,label]) => <button key={value} className="project-button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <div className="project-search">
          <input className="project-input" aria-label="Buscar proyectos" placeholder="Buscar proyectos…" value={search} onChange={e => setSearch(e.target.value)} type="search" />
          <select className="project-input" aria-label="Ordenar proyectos" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Actividad reciente</option><option value="name">Nombre</option></select>
        </div>
      </>}
      {query.isPending ? <div className="project-panel project-card" role="status">Cargando proyectos…</div> : query.isError ? <div className="project-panel project-card project-stack" role="alert"><p>No pudimos cargar tus proyectos.</p><button className="project-button" onClick={() => void query.refetch()}>Reintentar</button></div> : projects.length === 0 ? (
        <div className="project-panel project-empty">
          <Image src="/design-official/otter-at-desk.png" alt="" width={520} height={230} priority />
          <h2>Tu próximo objetivo empieza aquí</h2><p className="project-muted">Crea un proyecto para reunir tus tareas, notas y recursos.</p>
          <button className="project-button" data-primary="true" onClick={() => setCreateOpen(true)}>Crear mi primer proyecto</button>
        </div>
      ) : filtered.length === 0 ? <div className="project-panel project-card project-stack"><h2>Sin coincidencias</h2><p className="project-muted">No encontramos proyectos con los filtros actuales.</p><button className="project-button" onClick={() => { setSearch(""); setFilter("ALL"); }}>Limpiar filtros</button></div> : <>
        {owned.length > 0 && <div className="project-grid">
          {owned.map(p => <Link className="project-panel project-card project-list-card" key={p.id} href={`/projects/${p.id}`}>
            <span className="project-tag">{p.isDefault ? "Privado" : "Proyecto"}</span>
            <h2>{p.name}</h2><p className="project-muted">{p.description || "Un espacio para tu próximo objetivo."}</p>
            <div className="project-card-footer"><span>{p._count?.tasks ?? 0} tareas</span><span className="text-primary">Abrir →</span></div>
          </Link>)}
        </div>}
        {shared.length > 0 && <section className="project-panel project-card"><h2>Compartidos contigo</h2>
          {shared.map(p => <Link className="project-row" key={p.id} href={`/projects/${p.id}`}><span>{p.name}<small>{p.description || "Un objetivo compartido"}{p.members?.length ? ` · ${p.members.length} personas` : ""}</small></span><span>Colaborador</span></Link>)}
          <p className="project-small mt-4">Tus proyectos compartidos mantienen sus tareas, notas y conversaciones en contexto.</p>
        </section>}
      </>}
      {createOpen && <ProjectFormDialog onClose={() => setCreateOpen(false)} onSave={payload => mutations.create.mutateAsync(payload)} />}
    </ProjectWorkspaceShell>
  );
}
