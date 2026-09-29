"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { Inbox, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FAB } from "@/components/ui/FAB";
import { useCapture } from "@/context/CaptureContext";
import { QuickNoteItem } from "@/features/quicknotes/components/QuickNoteItem";
import { QuickNotePreviewModal } from "@/features/quicknotes/components/QuickNotePreviewModal";
import { useQuickNotesQuery } from "@/features/quicknotes/hooks/useQuickNotes";
import type { DetectedDate } from "@/features/quicknotes/utils/detectDate";
import type { QuickNote, QuickNoteStatus } from "@/types/entities";

export default function QuickNotesPage() {
  const router = useRouter();
  const capture = useCapture();
  const [view, setView] = useState<QuickNoteStatus>("INBOX");
  const [previewing, setPreviewing] = useState<QuickNote | null>(null);
  const inboxQuery = useQuickNotesQuery("INBOX", 50);
  const archivedQuery = useQuickNotesQuery("ARCHIVED", 50);
  const currentQuery = view === "INBOX" ? inboxQuery : archivedQuery;
  const notes = currentQuery.data ?? [];

  const createTaskFromCapture = (note: QuickNote, detected: DetectedDate | null) => {
    const prefill = encodeURIComponent(JSON.stringify({
      title: note.content,
      dueDate: detected?.isoDate ?? "",
    }));
    setPreviewing(null);
    router.push(`/tasks?modal=create&prefill=${prefill}&quickNoteId=${encodeURIComponent(note.id)}`);
  };

  const openCapture = () => capture.open("QUICK_NOTE");
  const openPreview = (note: QuickNote) => setPreviewing(note);

  return (
    <OfficialPage>
      <OfficialHeader eyebrow="MIS NOTAS" title={view === "INBOX" ? "Bandeja de entrada" : "Capturas archivadas"} description="Captura ahora. Organiza cuando tengas espacio." actions={<button className="official-button" data-primary onClick={openCapture}><Plus size={16}/>Nueva captura</button>}/>
      <div>
        <div className="flex flex-col gap-6">
          <div className="official-tabs" role="tablist" aria-label="Estado de las capturas">
            {([
              ["INBOX", "Pendientes", inboxQuery.data?.length ?? 0],
              ["ARCHIVED", "Archivadas", archivedQuery.data?.length ?? 0],
            ] as const).map(([value, label, count]) => (
              <button
                aria-selected={view === value}
                className="inline-flex items-center gap-2"
                key={value}
                onClick={() => setView(value)}
                role="tab"
                type="button"
              >
                {label}
                <span className="text-on-surface-variant">{count}</span>
              </button>
            ))}
          </div>

          {currentQuery.isLoading ? (
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-8 text-center font-body-sm text-body-sm text-on-surface-variant">Cargando capturas...</div>
          ) : currentQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-error bg-error-container p-8 text-center font-body-sm text-body-sm text-on-error-container">
              <p>No pudimos cargar tus capturas.</p>
               <button className="rounded-md px-2 py-1 font-label-md text-label-md underline underline-offset-2 hover:bg-error-container/40" onClick={() => void currentQuery.refetch()} type="button">Reintentar</button>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-8 text-center shadow-sm">
              <Inbox className="text-primary" size={28} />
              <p className="font-label-caps text-label-caps text-on-surface-variant">{view === "INBOX" ? "BANDEJA DESPEJADA" : "SIN ARCHIVO"}</p>
              <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">{view === "INBOX" ? "Captura una idea cuando aparezca y procésala después." : "Las capturas que archives aparecerán aquí."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest px-4 shadow-sm sm:px-5 lg:grid-cols-2 lg:gap-4 lg:divide-y-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none">
              {notes.map((note) => (
                 <QuickNoteItem
                   archived={view === "ARCHIVED"}
                   key={note.id}
                   note={note}
                   onOpen={openPreview}
                   onConvertToTask={view === "INBOX" ? createTaskFromCapture : undefined}
                 />
              ))}
            </div>
          )}

        </div>
      </div>
      {previewing && (
        <QuickNotePreviewModal
          note={previewing}
          onClose={() => setPreviewing(null)}
          onConvertToTask={view === "INBOX" ? createTaskFromCapture : undefined}
        />
      )}
      <div className="sm:hidden">
        <FAB ariaLabel="Nueva captura" onClick={openCapture} raised={capture.isOpen || Boolean(previewing)} />
      </div>
    </OfficialPage>
  );
}
