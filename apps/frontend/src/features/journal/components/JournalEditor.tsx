"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import type { JournalDraft, JournalEntry } from "@/types/entities";
import { deleteJournalDraft, fetchJournalDraft, saveJournalDraft, type JournalDraftPayload } from "../api/journal";
import { journalEntrySchema, type JournalEntryForm } from "../schemas/journal.schema";

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

export function JournalEditor({
  entry,
  onSave,
  onDelete,
  onBack,
}: {
  entry: JournalEntry | null;
  onSave: (form: JournalEntryForm) => Promise<void>;
  onDelete?: () => Promise<void>;
  onBack?: () => void;
}) {
  const [form, setForm] = useState<JournalEntryForm>({
    title: entry?.title ?? "",
    content: entry?.content ?? "",
    classification: entry?.classification ?? undefined,
    tags: entry?.tags ?? [],
  });
  const [tagsText, setTagsText] = useState((entry?.tags ?? []).join(", "));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restoredAt, setRestoredAt] = useState<Date | null>(null);
  const appliedRestoreRef = useRef(false);
  const isNew = entry === null;

  const draft = useDraftAutosave<JournalDraft, JournalDraftPayload>({
    load: fetchJournalDraft,
    save: saveJournalDraft,
    clear: deleteJournalDraft,
    isDirty: (payload) => Boolean(payload.title.trim() || payload.content.trim() || payload.classification?.trim() || payload.tags.length),
  });

  useEffect(() => {
    if (!draft.restored) return;
    appliedRestoreRef.current = true;
    // Apply an asynchronously restored draft to the controlled editor state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      title: draft.restored.title ?? "",
      content: draft.restored.content ?? "",
      classification: draft.restored.classification ?? undefined,
      tags: draft.restored.tags ?? [],
    });
    setTagsText((draft.restored.tags ?? []).join(", "));
    setRestoredAt(new Date(draft.restored.updatedAt));
  }, [draft.restored]);

  useEffect(() => {
    if (!isNew) return;
    if (appliedRestoreRef.current) {
      appliedRestoreRef.current = false;
      return;
    }
    draft.update({ title: form.title, content: form.content, classification: form.classification ?? null, tags: form.tags ?? [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, tagsText, isNew]);

  const set = <K extends keyof JournalEntryForm>(key: K, value: JournalEntryForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const result = journalEntrySchema.safeParse({ ...form, tags: parseTags(tagsText) });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Revisa los datos e inténtalo de nuevo");
      return;
    }
    setError("");
    try {
      await onSave(result.data);
      if (isNew) {
        await draft.discard();
        setRestoredAt(null);
      }
    } catch {
      setError("Ups, no pudimos guardar tu entrada. Inténtalo de nuevo.");
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    try {
      await onDelete();
      await draft.discard();
      setRestoredAt(null);
    } catch {
      setError("Ups, no pudimos borrar tu entrada. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="official-panel official-journal-editor flex min-h-[722px] flex-col gap-5">
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant">MI DIARIO</p>
        <div className="flex items-center gap-2">
          {onBack && (
            <button aria-label="Volver a mis entradas" className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface lg:hidden" onClick={onBack} type="button">
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="mt-1 font-headline-md text-headline-md text-on-surface">{entry ? "Editar entrada" : "Nueva entrada"}</h1>
        </div>
      </div>

      {restoredAt && (
        <p className="flex items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
          <span>Se restauró tu borrador de {restoredAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</span>
          <button
            className="min-h-11 rounded-md px-2 font-body-sm text-body-sm text-error transition-colors hover:bg-error-container/40 hover:underline"
            onClick={() => {
              setForm({ title: "", content: "", classification: undefined, tags: [] });
              setTagsText("");
              setRestoredAt(null);
              void draft.discard();
            }}
            type="button"
          >
            Descartar
          </button>
        </p>
      )}

      <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant">Título</span>
        <input autoFocus className="field mt-1" maxLength={200} onChange={(event) => set("title", event.target.value)} placeholder="¿Sobre qué escribes hoy?" value={form.title} />
      </label>

      <div className="grid grid-cols-1 gap-container-padding sm:grid-cols-2">
        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant">Clasificación (opcional)</span>
          <input className="field mt-1" maxLength={60} onChange={(event) => set("classification", event.target.value || undefined)} placeholder="Ej: Reflexión" value={form.classification ?? ""} />
        </label>
        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant">Etiquetas (opcional)</span>
          <input className="field mt-1" onChange={(event) => setTagsText(event.target.value)} placeholder="ideas, diario" value={tagsText} />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <span className="mb-1 font-label-md text-label-md text-on-surface-variant">Contenido</span>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md">
          <MarkdownEditor minHeight="min(24rem, 45vh)" onChange={(content) => set("content", content)} placeholder="Escribe libremente..." value={form.content} />
        </div>
      </div>

      {error && <p className="rounded-md border border-error bg-error-container p-2 font-body-sm text-body-sm text-on-error-container">{error}</p>}

      <div className={`sticky bottom-0 z-10 -mx-container-padding flex items-center gap-3 border-t border-outline-variant bg-surface px-container-padding pt-container-padding sm:-mx-section-gap sm:px-section-gap ${entry ? "justify-between" : "justify-end"}`}>
        {entry && onDelete ? (
          <button
            className={`min-h-11 rounded-md ${confirmDelete ? "bg-error px-4 font-body-sm text-body-sm text-error-foreground" : "px-2 font-body-sm text-body-sm text-error transition-colors hover:bg-error-container/30"}`}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              void remove();
            }}
            type="button"
          >
            {confirmDelete ? "¿Eliminar entrada?" : "Eliminar"}
          </button>
        ) : null}
        {isNew && (
          <span className="flex min-h-11 shrink-0 items-center font-body-sm text-body-sm text-on-surface-variant">
            {draft.state === "saving" ? "Guardando borrador..." : draft.state === "error" ? "Error al guardar el borrador" : draft.state === "saved" ? "Borrador guardado" : ""}
          </span>
        )}
        <button className="min-h-11 flex-1 rounded-md bg-primary px-4 font-body-sm text-body-sm text-on-primary shadow-cadence-1 transition-colors hover:bg-primary/90 sm:flex-none" onClick={() => void submit()} type="button">
          {entry ? "Guardar cambios" : "Guardar entrada"}
        </button>
      </div>
    </div>
  );
}
