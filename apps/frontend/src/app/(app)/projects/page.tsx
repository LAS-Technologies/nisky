"use client";

import { Check, FolderKanban, ListTodo, Plus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { FAB } from "@/components/ui/FAB";
import { AvatarStack } from "@/components/ui/Avatar";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useAuth } from "@/context/AuthProvider";
import { useAccessibleProjects, useProjectMutations } from "@/features/projects/hooks/useProjects";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProjectFilter = "ALL" | "OWNED" | "SHARED";

const PROJECT_FILTERS: Array<{ value: ProjectFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "OWNED", label: "Propios" },
  { value: "SHARED", label: "Compartidos" },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const accessibleQuery = useAccessibleProjects();
  const projectMutations = useProjectMutations();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("ALL");

  const projects = accessibleQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const searchFiltered = query
    ? projects.filter((project) => `${project.name} ${project.description ?? ""}`.toLowerCase().includes(query))
    : projects;
  const filtered = projectFilter === "OWNED"
    ? searchFiltered.filter((project) => project.userId === user?.id)
    : projectFilter === "SHARED"
      ? searchFiltered.filter((project) => project.userId !== user?.id)
      : searchFiltered;
  const owned = filtered.filter((project) => project.userId === user?.id);
  const shared = filtered.filter((project) => project.userId !== user?.id);
  const hasActiveFilter = Boolean(query) || projectFilter !== "ALL";
  const showOwnedSection = projectFilter !== "SHARED" && (projectFilter === "OWNED" || owned.length > 0 || shared.length === 0);

  const clearFilters = () => {
    setSearch("");
    setProjectFilter("ALL");
  };

  const renderGrid = (items: typeof projects, emptyLabel: string) =>
    items.length === 0 ? (
      <p className="rounded-lg border border-dashed border-outline-variant p-6 text-center font-body-sm text-body-sm text-on-surface-variant">
        {emptyLabel}
      </p>
    ) : (
      <div className="grid min-w-0 items-stretch grid-cols-1 gap-section-gap sm:grid-cols-2 xl:grid-cols-3">
        {items.map((project) => {
          const isShared = project.userId !== user?.id;
          const memberUsers = project.members ?? [];
          const people = memberUsers.some((member) => member.user.id === user?.id)
            ? memberUsers
            : [{ user: { id: user?.id ?? "", email: user?.email ?? "", name: user?.name ?? null, avatarUrl: user?.avatarUrl ?? null } }, ...memberUsers];
          const showPeople = isShared || memberUsers.length > 1;
          const taskCount = project._count?.tasks ?? 0;
          return (
            <Link
              className="group flex h-full min-w-0 flex-col gap-3 rounded-lg border border-outline-variant bg-surface p-section-gap transition-colors hover:border-primary/60 hover:bg-surface-container-low"
              href={`/projects/${project.id}`}
              key={project.id}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: project.color }} />
                <span className="min-w-0 flex-1 truncate font-body-md text-body-md font-medium group-hover:text-primary">
                  {project.name}
                </span>
                {project.isDefault ? (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-primary/25 bg-primary-fixed/50 px-1.5 py-0.5 font-label-caps text-[10px] uppercase tracking-wide text-primary">
                    Personal
                  </span>
                ) : isShared ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-secondary-container bg-secondary-container/60 px-1.5 py-0.5 font-label-caps text-[10px] uppercase tracking-wide text-on-secondary-container">
                    <Users size={10} /> Compartido
                  </span>
                ) : null}
              </div>

              <div className="min-h-[2.25rem]">
                {project.description && (
                  <p className="line-clamp-2 break-words font-body-sm text-body-sm text-on-surface-variant [overflow-wrap:anywhere]">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="mt-auto flex items-center gap-2">
                {showPeople ? <AvatarStack members={people} max={3} size="sm" /> : <span className="flex-1" />}
                <span className="ml-auto flex shrink-0 items-center gap-1.5 font-data-mono text-data-mono text-[15px] font-semibold tabular-nums text-on-surface" title="Tareas pendientes del proyecto">
                  <ListTodo size={15} /> {taskCount}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    );

  return (
    <section className="flex h-full min-h-0 min-w-0 max-w-full flex-col p-container-padding sm:p-section-gap">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Mis proyectos</h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  aria-label="Buscar proyectos"
                  className="field h-9 w-full pl-8"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar proyectos..."
                  type="search"
                  value={search}
                />
              </div>
              <div aria-label="Filtrar proyectos" className="flex w-full rounded-lg border border-outline-variant bg-surface-bright p-1 sm:w-auto" role="group">
                {PROJECT_FILTERS.map((filter) => (
                  <button
                    aria-pressed={projectFilter === filter.value}
                    className={`flex-1 rounded-md px-2.5 py-1.5 font-label-caps text-label-caps transition-colors sm:flex-none ${projectFilter === filter.value ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}
                    key={filter.value}
                    onClick={() => setProjectFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <button
                className="hidden shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 font-body-sm text-body-sm text-on-primary hover:bg-primary-container hover:text-on-primary-container sm:inline-flex"
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                <Plus size={15} /> Nuevo proyecto
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-section-gap overflow-x-hidden overflow-y-auto p-container-padding">
          {accessibleQuery.isLoading ? (
            <p className="py-10 text-center font-body-sm text-body-sm text-on-surface-variant">Cargando proyectos...</p>
          ) : projects.length === 0 ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-section-gap text-center">
              <FolderKanban className="text-primary" size={28} />
              <p className="font-label-caps text-label-caps text-on-surface-variant">SIN PROYECTOS</p>
              <p className="max-w-xl font-body-sm text-body-sm text-on-surface-variant">
                Crea proyectos para agrupar tareas, notas y trabajo en equipo.
              </p>
              <button className="mt-2 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary hover:bg-primary-container" onClick={() => setCreateOpen(true)} type="button">
                Crear un proyecto
              </button>
            </div>
          ) : filtered.length === 0 && hasActiveFilter ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-section-gap text-center">
              <Search className="text-primary" size={28} />
              <p className="font-label-caps text-label-caps text-on-surface-variant">SIN COINCIDENCIAS</p>
              <p className="max-w-xl font-body-sm text-body-sm text-on-surface-variant">
                No encontramos proyectos con los filtros actuales.
              </p>
              <button className="mt-2 rounded-md border border-outline-variant px-4 py-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high" onClick={clearFilters} type="button">
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              {showOwnedSection && (
                <div>
                  {renderGrid(owned, "Aún no tienes proyectos propios.")}
                </div>
              )}
              {projectFilter !== "OWNED" && shared.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Compartidos contigo</h2>
                  {renderGrid(shared, "")}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sm:hidden">
        <FAB ariaLabel="Nuevo proyecto" onClick={() => setCreateOpen(true)} />
      </div>
      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} onCreate={projectMutations.create.mutateAsync} />}
    </section>
  );
}

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: { name: string; description?: string | null; targetDate?: string | null; color?: string }) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#303e51");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onCreate({ name: trimmed, description: description.trim() || null, targetDate: targetDate || null, color });
      toast.success("¡Proyecto creado!");
      onClose();
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos crear el proyecto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="top-auto bottom-0 flex h-[min(90dvh,48rem)] max-h-[90dvh] w-full max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-outline-variant bg-surface p-0 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl" data-keyboard-sheet showCloseButton={false}>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant bg-surface-bright px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">
            <FolderKanban size={16} /> Nuevo proyecto
          </DialogTitle>
          <DialogDescription className="sr-only">Crea un proyecto para agrupar tareas y trabajo en equipo.</DialogDescription>
          <DialogClose asChild>
             <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button">
              <X size={19} />
            </button>
          </DialogClose>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" data-modal-scroll>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">NOMBRE</span>
            <input
              autoFocus
              className="field mt-1"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              placeholder="Nombre del proyecto"
              value={name}
            />
          </label>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">DESCRIPCIÓN (OPCIONAL)</span>
            <textarea className="field mt-1 min-h-20 resize-y py-2" maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Qué contexto debe conocer el equipo..." value={description} />
          </label>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">FECHA OBJETIVO (OPCIONAL)</span>
            <input className="field mt-1" onChange={(event) => setTargetDate(event.target.value)} type="date" value={targetDate} />
          </label>
          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant">COLOR</span>
            <div className="mt-1">
              <ColorPicker onChange={setColor} value={color} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-outline-variant bg-surface-container-low px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <DialogClose asChild>
            <button className="min-h-11 rounded-md border border-outline-variant px-4 py-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high" type="button">Cancelar</button>
          </DialogClose>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-50"
            disabled={busy || !name.trim()}
            onClick={() => void submit()}
            type="button"
          >
            <Check size={14} /> Crear
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
