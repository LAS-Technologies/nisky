"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FAB } from "@/components/ui/FAB";
import { KnowledgeSidebar, type KnowledgeFilter } from "@/features/knowledge/components/KnowledgeSidebar";
import { NoteCard } from "@/features/knowledge/components/NoteCard";
import { NotePreviewModal } from "@/features/knowledge/components/NotePreviewModal";
import { NotePagination } from "@/features/knowledge/components/NotePagination";
import { useNoteMutations, useFacetsQuery, useNotesQuery } from "@/features/knowledge/hooks/useKnowledge";
import type { Note } from "@/types/entities";
import type { Project } from "@/types/entities";
import { useAuth } from "@/context/AuthProvider";

export function ProjectNotes({ project }: { project: Project }) {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<KnowledgeFilter>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<Note | null>(null);
  const query = useNotesQuery({
    page,
    q: search.trim() || undefined,
    category: filter?.type === "category" ? filter.name : undefined,
    tag: filter?.type === "tag" ? filter.name : undefined,
    projectId: project.id,
    limit: 20,
  });
  const facetsQuery = useFacetsQuery(project.id);
  const mutations = useNoteMutations();
  const notes = query.data?.data ?? [];
  const hasFilters = Boolean(search) || Boolean(filter);

  const updateFilter = (nextFilter: KnowledgeFilter) => {
    setPage(1);
    setFilter(nextFilter);
  };

  const updateSearch = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const togglePin = async (note: Note, pinned = !note.pinned) => {
    if (note.user?.id !== user?.id) return;
    try {
      await mutations.togglePin.mutateAsync({ id: note.id, pinned });
      return true;
    } catch {
      toast.error("No pudimos actualizar la nota.");
      return false;
    }
  };

  const removePreview = async () => {
    if (!previewing || previewing.user?.id !== user?.id) return;
    await mutations.remove.mutateAsync(previewing.id);
    toast.success("Nota eliminada");
    setPreviewing(null);
  };

  const openNew = () => {
    const returnTo = `/projects/${project.id}?tab=notes`;
    router.push(`/knowledge/new?projectId=${encodeURIComponent(project.id)}&returnTo=${encodeURIComponent(returnTo)}`);
  };

  const openPreview = (note: Note) => {
    setPreviewing(note);
  };

  const openEdit = (note: Note) => {
    const returnTo = `/projects/${project.id}?tab=notes`;
    router.push(`/knowledge/${note.id}/edit?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <section className="min-w-0">
      <details className="mb-5"><summary className="project-small cursor-pointer">Buscar y filtrar notas</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><input aria-label="Buscar notas del proyecto" className="project-input" value={search} onChange={e => updateSearch(e.target.value)} placeholder="Buscar notas…" type="search" /><KnowledgeSidebar active={filter} facets={facetsQuery.data} onFilter={updateFilter} /></div></details>
      <div>
        <div className="min-w-0">
          {query.isLoading ? (
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-8 text-center font-body-sm text-body-sm text-on-surface-variant">Cargando notas...</div>
          ) : query.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-error bg-error-container p-8 text-center font-body-sm text-body-sm text-on-error-container">
              <p>No pudimos cargar las notas del proyecto.</p>
               <button className="rounded-md px-2 py-1 font-label-md text-label-md underline underline-offset-2 hover:bg-error-container/30" onClick={() => void query.refetch()} type="button">Reintentar</button>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-8 text-center shadow-sm">
              <BookOpen className="text-primary" size={28} />
              <p className="font-label-caps text-label-caps text-on-surface-variant">NOTAS DEL PROYECTO</p>
              <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">{hasFilters ? "No encontramos notas con esa búsqueda." : "Guarda aquí el contexto y las referencias del proyecto."}</p>
            </div>
          ) : (
            <>
              <div className="project-grid project-note-grid">
                {notes.map((note) => (
                    <NoteCard projectStyle canEdit={note.user?.id === user?.id} canEditContent={note.user?.id === user?.id || note.collaboratorsCanEdit} key={note.id} note={note} onEdit={openEdit} onOpen={openPreview} onTogglePin={async (item) => { await togglePin(item); }} showAuthor />
                ))}
              </div>
              <NotePagination isFetching={query.isFetching} meta={query.data?.meta} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <section className="project-panel project-card mt-6 min-h-[210px]"><h2>Conocimiento que permanece</h2><p className="project-muted">Las notas del proyecto reúnen decisiones, referencias e ideas para que el equipo pueda volver a ellas.</p><p className="project-muted mt-4">Selecciona una nota para leerla o editarla según tus permisos.</p></section>
      <div className="sm:hidden">
          <FAB ariaLabel="Nueva nota" onClick={openNew} raised={Boolean(previewing)} />
       </div>
       {previewing && (
         <NotePreviewModal
            key={previewing.id}
            note={previewing}
            onClose={() => setPreviewing(null)}
            onDelete={previewing.user?.id === user?.id ? removePreview : undefined}
             onEdit={previewing.user?.id === user?.id || previewing.collaboratorsCanEdit ? () => openEdit(previewing) : undefined}
            onTogglePin={previewing.user?.id === user?.id ? (pinned) => togglePin(previewing, pinned) : undefined}
          />
        )}
    </section>
  );
}
