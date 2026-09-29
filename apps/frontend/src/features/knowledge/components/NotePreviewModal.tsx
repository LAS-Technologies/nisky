"use client";
import "@/components/ui/official.css";

import { useState } from "react";
import { FileText, Maximize2, Pencil, Pin, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Note } from "@/types/entities";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownPreview } from "@/components/ui/MarkdownPreview";
import { PreviewSheet } from "@/components/ui/PreviewSheet";

const FULL_VIEW_CHARACTER_LIMIT = 1_200;
const FULL_VIEW_LINE_LIMIT = 20;

function noteDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isLongNote(note: Note) {
  return note.content.length > FULL_VIEW_CHARACTER_LIMIT || note.content.split(/\r?\n/).length > FULL_VIEW_LINE_LIMIT;
}

function NoteMeta({ note }: { note: Note }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {note.category && (
          <span className="rounded-full bg-secondary-container px-2.5 py-1 font-label-md text-label-md text-on-secondary-container">
            {note.category}
          </span>
        )}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.tags.map((tag, index) => (
              <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-label-md text-label-md text-on-surface-variant" key={`${tag}-${index}`}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {note.pinned && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tertiary-container px-2.5 py-1 font-label-md text-label-md text-on-tertiary-container">
          <Pin aria-hidden="true" size={13} /> Fijada
        </span>
      )}
      <span className="w-full font-data-mono text-data-mono text-[11px] text-on-surface-variant">Actualizada {noteDate(note.updatedAt)}</span>
    </div>
  );
}

function FullNoteView({
  note,
  onBack,
  onClose,
  onEdit,
  onTogglePin,
}: {
  note: Note;
  onBack: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onTogglePin?: (pinned: boolean) => Promise<boolean | void>;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="fixed inset-0 bottom-auto right-auto top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-surface-bright p-0 outline-none sm:left-1/2 sm:top-1/2 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-outline-variant"
        showCloseButton={false}
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-4 rounded-none border-b border-outline-variant bg-surface-bright px-5 py-4 text-left sm:rounded-t-2xl sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">NOTA COMPLETA</p>
            <DialogTitle className="mt-1 min-w-0 break-words text-lg leading-6 [overflow-wrap:anywhere] sm:text-xl sm:leading-7">{note.title}</DialogTitle>
            <DialogDescription className="sr-only">Lectura completa de la nota.</DialogDescription>
          </div>
          <DialogClose asChild>
            <button aria-label="Cerrar vista completa" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button">
              <X size={19} />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-container-low/40 px-4 py-5 sm:px-7 sm:py-7" data-modal-scroll>
          <div className="mx-auto min-w-0 max-w-5xl space-y-5">
            <NoteMeta note={note} />
            <article className="min-w-0 overflow-visible rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
              {note.content.trim() ? (
                <MarkdownPreview className="w-full max-w-none px-5 py-5 sm:px-8 sm:py-8" content={note.content} />
              ) : (
                <p className="px-5 py-12 text-center font-body-sm text-body-sm text-on-surface-variant">Sin contenido.</p>
              )}
            </article>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-none border-t border-outline-variant bg-surface-bright px-5 py-4 sm:rounded-b-2xl sm:px-7">
          <button className="min-h-11 rounded-xl border border-outline-variant px-3 py-2 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" onClick={onBack} type="button">Volver</button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onTogglePin && (
              <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-outline-variant px-3 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => void onTogglePin(!note.pinned)} type="button">
                <Pin size={15} /> {note.pinned ? "Desfijar" : "Fijar"}
              </button>
            )}
            {onEdit && (
              <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container" onClick={onEdit} type="button">
                <Pencil size={15} /> Editar nota
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotePreviewModal({
  note,
  onClose,
  onDelete,
  onEdit,
  onTogglePin,
}: {
  note: Note;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onEdit?: () => void;
  onTogglePin?: (pinned: boolean) => Promise<boolean | void>;
}) {
  const [pinned, setPinned] = useState(note.pinned);
  const [fullView, setFullView] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const togglePin = async () => {
    if (!onTogglePin) return;
    const nextPinned = !pinned;
    const result = await onTogglePin(nextPinned);
    if (result !== false) setPinned(nextPinned);
  };

  const remove = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      toast.error("No pudimos borrar la nota. Inténtalo de nuevo.");
      setDeleting(false);
    }
  };

  const currentNote = pinned === note.pinned ? note : { ...note, pinned };

  if (fullView) {
    return <FullNoteView note={currentNote} onBack={() => setFullView(false)} onClose={onClose} onEdit={onEdit} onTogglePin={onTogglePin ? async (next) => { const result = await onTogglePin(next); if (result !== false) setPinned(next); return result; } : undefined} />;
  }

  return (
    <PreviewSheet centered
      eyebrow="Nota"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {onDelete && (
            <button
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2.5 font-label-md text-label-md font-semibold disabled:cursor-wait disabled:opacity-60 ${deleteConfirm ? "bg-error text-error-foreground" : "text-error hover:bg-error-container/40"}`}
              disabled={deleting}
              onClick={() => {
                if (deleteConfirm) void remove();
                else setDeleteConfirm(true);
              }}
              type="button"
            >
              <Trash2 size={15} /> {deleteConfirm ? "¿Eliminar nota?" : "Eliminar"}
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isLongNote(currentNote) && (
              <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-outline-variant px-3 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => setFullView(true)} type="button">
                <Maximize2 size={15} /> Ver completa
              </button>
            )}
            {onTogglePin && (
              <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-outline-variant px-3 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => void togglePin()} type="button">
                <Pin size={15} /> {pinned ? "Desfijar" : "Fijar"}
              </button>
            )}
            {onEdit && (
              <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container" onClick={onEdit} type="button">
                <Pencil size={15} /> Editar nota
              </button>
            )}
          </div>
        </div>
      }
      onClose={onClose}
      title={currentNote.title}
      titleClassName="text-lg leading-6 sm:text-xl sm:leading-7"
      tall
      extraWide
      wide
    >
      <div className="min-w-0 space-y-5">
        <NoteMeta note={currentNote} />
        <section className="min-w-0 overflow-visible rounded-2xl border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-3 text-on-surface-variant">
            <FileText aria-hidden="true" size={16} />
            <p className="font-label-caps text-label-caps">CONTENIDO</p>
          </div>
          {currentNote.content.trim() ? (
            <MarkdownPreview className="w-full max-w-none px-4 py-5 sm:px-6 sm:py-6" content={currentNote.content} />
          ) : (
            <p className="px-4 py-10 text-center font-body-sm text-body-sm text-on-surface-variant">Sin contenido.</p>
          )}
        </section>
      </div>
    </PreviewSheet>
  );
}
