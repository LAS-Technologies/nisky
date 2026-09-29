"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Plus } from "lucide-react";
import { FAB } from "@/components/ui/FAB";
import { KnowledgeSidebar } from "@/features/knowledge/components/KnowledgeSidebar";
import type { KnowledgeFilter } from "@/features/knowledge/components/KnowledgeSidebar";
import { NoteCard } from "@/features/knowledge/components/NoteCard";
import { NotePreviewModal } from "@/features/knowledge/components/NotePreviewModal";
import { NotePagination } from "@/features/knowledge/components/NotePagination";
import { useFacetsQuery, useNoteMutations, useNotesQuery } from "@/features/knowledge/hooks/useKnowledge";
import { useProjectsQuery } from "@/features/projects/hooks/useProjects";
import type { Note } from "@/types/entities";

export default function KnowledgePage() {
  const router = useRouter();
  const [filter, setFilter] = useState<KnowledgeFilter>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<Note | null>(null);
  const projectsQuery = useProjectsQuery();
  const projectFilter = filter?.type === "project" ? filter : null;

  const query = useNotesQuery({
    page,
    q: search || undefined,
    category: filter?.type === "category" ? filter.name : undefined,
    tag: filter?.type === "tag" ? filter.name : undefined,
    ownerOnly: true,
    pinned: filter?.type === "pinned" ? true : undefined,
    projectId: projectFilter?.id ?? undefined,
    withoutProject: projectFilter?.id === null ? true : undefined,
    limit: 20,
  });
  const facetsQuery = useFacetsQuery();
  const mutations = useNoteMutations();

  const notes = query.data?.data ?? [];
  const updateFilter = (nextFilter: KnowledgeFilter) => {
    setPage(1);
    setFilter(nextFilter);
  };

  const updateSearch = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const togglePin = async (note: Note, pinned = !note.pinned) => {
    try {
      await mutations.togglePin.mutateAsync({ id: note.id, pinned });
      return true;
    } catch {
      toast.error("Ups, no pudimos actualizar tu nota.");
      return false;
    }
  };

  const removePreview = async () => {
    if (!previewing) return;
    await mutations.remove.mutateAsync(previewing.id);
    toast.success("¡Nota eliminada!");
    setPreviewing(null);
  };

  const openNew = () => {
    router.push(`/knowledge/new?returnTo=${encodeURIComponent("/knowledge")}`);
  };

  const openPreview = (note: Note) => {
    setPreviewing(note);
  };

  const openEdit = (note: Note) => {
    router.push(`/knowledge/${note.id}/edit?returnTo=${encodeURIComponent("/knowledge")}`);
  };

  const closePreview = () => setPreviewing(null);

  return (
    <OfficialPage>
      <OfficialHeader eyebrow="MIS NOTAS" title="Notas y referencias" description="Conecta ideas. Conserva lo que te inspira." actions={<button className="official-button" data-primary onClick={openNew}><Plus size={16}/>Nueva nota</button>}/>
      <div className="official-toolbar">
        <input className="field min-w-0 flex-1" aria-label="Buscar notas" onChange={event => updateSearch(event.target.value)} placeholder="Buscar notas…" value={search}/>
        <Link className="official-button" href="/quick-notes">Capturas rápidas</Link>
      </div>
      <div>
        {query.isLoading ? (
          <div className="flex h-full items-center justify-center font-body-sm text-body-sm text-on-surface-variant">Cargando notas...</div>
        ) : query.isError ? (
          <div className="flex h-full items-center justify-center font-body-sm text-body-sm text-error">Ups, no pudimos cargar tus notas. Inténtalo de nuevo.</div>
        ) : (
          <div className="official-notes-grid">
             <KnowledgeSidebar active={filter} facets={facetsQuery.data} onFilter={updateFilter} projects={projectsQuery.data} />
             <div className="min-w-0">
             {notes.length === 0 ? (
               <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-section-gap text-center shadow-sm">
                <BookOpen className="text-primary" size={28} />
                <p className="font-label-caps text-label-caps text-on-surface-variant">MIS NOTAS</p>
                <p className="max-w-xl font-body-sm text-body-sm text-on-surface-variant">
                  {filter || search ? "No encontramos notas con esa búsqueda." : "Guarda aquí tus notas, referencias e ideas."}
                </p>
               </div>
             ) : (
               <>
                 <div className="official-note-cards">
                   {notes.map((note) => (
                        <NoteCard officialStyle key={note.id} note={note} onEdit={openEdit} onOpen={openPreview} onTogglePin={async (item) => { await togglePin(item); }} project={note.project} />
                   ))}
                 </div>
                 <NotePagination isFetching={query.isFetching} meta={query.data?.meta} onPageChange={setPage} />
               </>
             )}
             </div>
           </div>
        )}
      </div>
       <div className="sm:hidden">
          <FAB ariaLabel="Nueva nota" onClick={openNew} raised={Boolean(previewing)} />
        </div>
        {previewing && (
          <NotePreviewModal
            key={previewing.id}
             note={previewing}
             onClose={closePreview}
             onDelete={removePreview}
             onEdit={() => openEdit(previewing)}
             onTogglePin={(pinned) => togglePin(previewing, pinned)}
           />
         )}
     </OfficialPage>
  );
}
