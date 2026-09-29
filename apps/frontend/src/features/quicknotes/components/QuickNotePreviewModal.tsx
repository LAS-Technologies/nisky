"use client";
import "@/components/ui/official.css";

import { ArrowRight, CalendarClock, Inbox, PencilLine } from "lucide-react";
import type { QuickNote } from "@/types/entities";
import { PreviewSheet } from "@/components/ui/PreviewSheet";
import { formatCreatedAt } from "@/lib/utils";
import { detectDate, type DetectedDate } from "../utils/detectDate";

export function QuickNotePreviewModal({
  note,
  onClose,
  onConvertToTask,
}: {
  note: QuickNote;
  onClose: () => void;
  onConvertToTask?: (note: QuickNote, detected: DetectedDate | null) => void;
}) {
  const detected = detectDate(note.content);

  return (
    <PreviewSheet centered
      eyebrow="Captura rápida"
      footer={onConvertToTask ? <button className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container" onClick={() => onConvertToTask(note, detected)} type="button"><ArrowRight size={15} /> Crear tarea</button> : undefined}
      onClose={onClose}
      title="Idea capturada"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 font-data-mono text-data-mono text-[11px] text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5"><Inbox size={13} /> {note.status === "INBOX" ? "Pendiente" : "Archivada"}</span>
          <span>Capturada {formatCreatedAt(note.createdAt)}</span>
        </div>
        {detected && <p className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-2.5 py-1 font-label-md text-label-md text-on-tertiary-container"><CalendarClock size={13} /> Fecha detectada: {detected.label}</p>}
        <p className="whitespace-pre-wrap break-words font-body-lg text-body-lg leading-8 text-on-surface">{note.content}</p>
        <p className="flex items-center gap-2 border-t border-outline-variant pt-4 font-body-sm text-body-sm text-on-surface-variant"><PencilLine size={15} /> Procesa esta captura cuando sepas si será una tarea, nota o referencia.</p>
      </div>
    </PreviewSheet>
  );
}
