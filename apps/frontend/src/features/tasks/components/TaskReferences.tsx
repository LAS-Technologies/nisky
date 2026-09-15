"use client";

import { ArrowDown, ArrowUp, ExternalLink, Link2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { TaskReference } from "@/types/entities";
import { cn } from "@/lib/utils";
import { useTaskReferenceMutations, useTaskReferences } from "../hooks/useTaskReferences";

const SOURCE_LABEL: Record<TaskReference["source"], string> = {
  MANUAL: "Manual",
  MOODLE: "Moodle",
  CANVAS: "Canvas",
  UASD: "UASD",
};

type ReferenceDraft = { title: string; url: string };

function emptyDraft(): ReferenceDraft {
  return { title: "", url: "" };
}

function referenceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function TaskReferences({
  taskId,
  initialReferences,
}: {
  taskId: string;
  initialReferences?: TaskReference[];
}) {
  const query = useTaskReferences(taskId);
  const mutations = useTaskReferenceMutations(taskId);
  const [draft, setDraft] = useState<ReferenceDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const references = query.data ?? initialReferences ?? [];
  const saving = mutations.create.isPending || mutations.update.isPending;

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const openEdit = (reference: TaskReference) => {
    setEditingId(reference.id);
    setDraft({ title: reference.title ?? "", url: reference.url });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setEditingId(null);
    setFormOpen(false);
    setDraft(emptyDraft());
  };

  const saveReference = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = draft.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("La referencia debe comenzar con http:// o https://.");
      return;
    }
    try {
      const payload = { title: draft.title.trim() || null, url };
      if (editingId) {
        await mutations.update.mutateAsync({ referenceId: editingId, payload });
      } else {
        await mutations.create.mutateAsync(payload);
      }
      closeForm();
    } catch {
      toast.error("No pudimos guardar la referencia.");
    }
  };

  const removeReference = async (reference: TaskReference) => {
    try {
      await mutations.remove.mutateAsync(reference.id);
      if (editingId === reference.id) closeForm();
    } catch {
      toast.error("No pudimos eliminar la referencia.");
    }
  };

  const moveReference = async (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= references.length || mutations.reorder.isPending) return;
    const reordered = [...references];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    try {
      await mutations.reorder.mutateAsync(reordered.map((reference, order) => ({ id: reference.id, order })));
    } catch {
      toast.error("No pudimos reordenar las referencias.");
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="flex items-center gap-2 font-label-caps text-label-caps uppercase text-on-surface-variant">
          <Link2 aria-hidden="true" size={14} />
          Referencias
          {references.length > 0 && <span className="font-data-mono text-data-mono text-[11px]">{references.length}</span>}
        </h3>
        <button
          aria-label={formOpen ? "Cerrar formulario de referencias" : "Añadir referencia"}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
          onClick={formOpen ? closeForm : openCreate}
          type="button"
        >
          {formOpen ? <X aria-hidden="true" size={14} /> : <Plus aria-hidden="true" size={14} />}
          {formOpen ? "Cerrar" : "Añadir"}
        </button>
      </div>

      {references.length > 0 ? (
        <div className="divide-y divide-outline-variant/60 rounded-md border border-outline-variant/70">
          {references.map((reference, index) => (
            <div className="group flex min-w-0 items-center gap-2 px-2.5 py-2" key={reference.id}>
              <ExternalLink aria-hidden="true" className="shrink-0 text-on-surface-variant" size={14} />
              <a
                className="min-w-0 flex-1 truncate text-[13px] font-medium text-on-surface hover:text-primary"
                href={reference.url}
                rel="noreferrer noopener"
                target="_blank"
                title={reference.url}
              >
                <span className="block truncate">{reference.title?.trim() || referenceHost(reference.url)}</span>
                {reference.title?.trim() && <span className="block truncate text-[11px] font-normal text-on-surface-variant">{referenceHost(reference.url)}</span>}
              </a>
              {reference.source !== "MANUAL" && (
                <span className="shrink-0 rounded-sm bg-surface-container-high px-1.5 py-0.5 font-label-caps text-[9px] uppercase tracking-[0.08em] text-on-surface-variant">
                  {SOURCE_LABEL[reference.source]}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  aria-label={`Subir ${reference.title || "referencia"}`}
                  className="flex size-6 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:opacity-30"
                  disabled={index === 0 || mutations.reorder.isPending}
                  onClick={() => void moveReference(index, -1)}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" size={13} />
                </button>
                <button
                  aria-label={`Bajar ${reference.title || "referencia"}`}
                  className="flex size-6 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:opacity-30"
                  disabled={index === references.length - 1 || mutations.reorder.isPending}
                  onClick={() => void moveReference(index, 1)}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" size={13} />
                </button>
                <button
                  aria-label={`Editar ${reference.title || "referencia"}`}
                  className="flex size-6 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                  onClick={() => openEdit(reference)}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={13} />
                </button>
                <button
                  aria-label={`Eliminar ${reference.title || "referencia"}`}
                  className="flex size-6 items-center justify-center rounded text-on-surface-variant hover:bg-error-container hover:text-error"
                  disabled={mutations.remove.isPending}
                  onClick={() => void removeReference(reference)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {formOpen && (
        <form className="space-y-3 border-t border-outline-variant/50 pt-3" onSubmit={(event) => void saveReference(event)}>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <label className="sr-only" htmlFor={`reference-title-${taskId}`}>Título de la referencia</label>
            <input
              className={cn("h-10 min-w-0 rounded-lg border border-outline-variant/70 bg-surface-bright px-3 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15")}
              id={`reference-title-${taskId}`}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Título (opcional)"
              value={draft.title}
            />
            <label className="sr-only" htmlFor={`reference-url-${taskId}`}>URL de la referencia</label>
            <input
              className="h-10 min-w-0 rounded-lg border border-outline-variant/70 bg-surface-bright px-3 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15"
              id={`reference-url-${taskId}`}
              onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
              placeholder="https://..."
              required
              type="url"
              value={draft.url}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="min-h-10 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container-low" disabled={saving} onClick={closeForm} type="button">
              Cancelar
            </button>
            <button className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60" disabled={saving} type="submit">
              {saving && <Loader2 aria-hidden="true" className="animate-spin" size={13} />}
              {editingId ? "Guardar" : "Añadir"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
