"use client";
import "@/components/ui/official.css";

import { CalendarDays, Pencil } from "lucide-react";
import type { JournalEntry } from "@/types/entities";
import { MarkdownPreview } from "@/components/ui/MarkdownPreview";
import { PreviewSheet } from "@/components/ui/PreviewSheet";

function entryDate(value: string) {
  return new Date(value).toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function JournalPreviewModal({
  entry,
  onClose,
  onEdit,
}: {
  entry: JournalEntry;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <PreviewSheet centered
      eyebrow="Mi diario"
      footer={<button className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container" onClick={onEdit} type="button"><Pencil size={15} /> Editar entrada</button>}
      onClose={onClose}
      title={entry.title || "Entrada sin título"}
      wide
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 font-data-mono text-data-mono text-[11px] text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {entryDate(entry.createdAt)}</span>
          {entry.classification && <span className="rounded-full bg-secondary-container px-2.5 py-1 font-label-md text-label-md text-on-secondary-container">{entry.classification}</span>}
        </div>
        {entry.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{entry.tags.map((tag, index) => <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-label-md text-label-md text-on-surface-variant" key={`${tag}-${index}`}>#{tag}</span>)}</div>}
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest">
          {entry.content.trim() ? <MarkdownPreview className="px-4 py-4" content={entry.content} /> : <p className="px-4 py-8 text-center font-body-sm text-body-sm text-on-surface-variant">Esta entrada todavía no tiene contenido.</p>}
        </div>
      </div>
    </PreviewSheet>
  );
}
