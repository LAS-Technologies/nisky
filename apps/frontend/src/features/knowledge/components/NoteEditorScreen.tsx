"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, FileText, FolderOpen, Pin, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { useAccessibleProjects } from "@/features/projects/hooks/useProjects";
import { useFacetsQuery, useNoteMutations } from "../hooks/useKnowledge";
import { deleteNoteDraft, fetchNoteDraft, saveNoteDraft, type NoteDraftPayload } from "../api/knowledge";
import { noteFormSchema, type NoteForm } from "../schemas/knowledge.schema";
import type { Note, NoteDraft } from "@/types/entities";

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function emptyForm(defaultProjectId?: string | null): NoteForm {
  return {
    title: "",
    content: "",
    category: undefined,
    tags: [],
    pinned: false,
    collaboratorsCanEdit: false,
    projectId: defaultProjectId ?? undefined,
  };
}

function formatDraftTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function resizeTitleInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
}

function FacetSuggestions({ id, items, onSelect }: { id: string; items: string[]; onSelect: (value: string) => void }) {
  return (
    <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-lg" id={id} role="listbox">
      {items.map((item) => (
        <button
          className="flex min-h-10 w-full items-center rounded-lg px-3 text-left font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          key={item}
          onClick={() => onSelect(item)}
          onMouseDown={(event) => event.preventDefault()}
          aria-selected="false"
          role="option"
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function safeNoteReturnTo(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function EditorLoading() {
  return <section className="flex h-full min-h-0 items-center justify-center bg-background font-body-sm text-body-sm text-on-surface-variant">Cargando editor...</section>;
}

export function EditorMessage({ title = "Editar nota", message, onBack }: { title?: string; message: string; onBack: () => void }) {
  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onBack(); }}>
      <DialogContent className="max-w-md overflow-hidden rounded-lg border-outline-variant bg-surface p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-outline-variant bg-surface-bright px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-container text-error">
              <AlertCircle aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-headline-xs text-headline-xs normal-case tracking-normal">{title}</DialogTitle>
              <DialogDescription className="mt-2 font-body-md text-body-md text-on-surface-variant">{message}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-0 flex-row justify-end border-t-0 bg-surface-container-low px-5 py-4">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body-md text-body-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container" onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" size={16} /> Volver
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NoteEditorScreen({
  defaultProjectId,
  note = null,
  returnTo,
}: {
  defaultProjectId?: string | null;
  note?: Note | null;
  returnTo: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const projectsQuery = useAccessibleProjects();
  const mutations = useNoteMutations();
  const isNew = note === null;
  const [form, setForm] = useState<NoteForm>(() => note ? {
    title: note.title,
    content: note.content,
    category: note.category ?? undefined,
    tags: note.tags,
    pinned: note.pinned,
    collaboratorsCanEdit: note.collaboratorsCanEdit,
    projectId: note.projectId,
  } : emptyForm(defaultProjectId));
  const facetsQuery = useFacetsQuery(form.projectId);
  const [tagsText, setTagsText] = useState(() => (note?.tags ?? []).join(", "));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restoredAt, setRestoredAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState<"category" | "tags" | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const restoredDraftRef = useRef(false);
  const skipDraftSyncRef = useRef(false);
  const isOwner = !note || note.userId === user?.id;
  const collaboratorEditing = Boolean(note && user && note.userId !== user.id);

  const draft = useDraftAutosave<NoteDraft, NoteDraftPayload>({
    load: isNew ? fetchNoteDraft : async () => null,
    save: isNew ? saveNoteDraft : async () => {},
    clear: isNew ? deleteNoteDraft : async () => {},
    isDirty: (payload) => Boolean(
      payload.title.trim() ||
      payload.content.trim() ||
      payload.category?.trim() ||
      payload.tags.length ||
      payload.pinned ||
      payload.projectId,
    ),
  });

  useEffect(() => {
    if (!draft.restored || restoredDraftRef.current) return;
    restoredDraftRef.current = true;
    skipDraftSyncRef.current = true;
    setDraftRestored(true);
    setForm({
      title: draft.restored.title ?? "",
      content: draft.restored.content ?? "",
      category: draft.restored.category ?? undefined,
      tags: draft.restored.tags ?? [],
      pinned: draft.restored.pinned ?? false,
      collaboratorsCanEdit: false,
      projectId: draft.restored.projectId ?? (defaultProjectId ?? undefined),
    });
    setTagsText((draft.restored.tags ?? []).join(", "));
    setRestoredAt(new Date(draft.restored.updatedAt));
  }, [defaultProjectId, draft.restored]);

  useEffect(() => {
    if (!isNew) return;
    if (skipDraftSyncRef.current) {
      skipDraftSyncRef.current = false;
      return;
    }
    draft.update({
      title: form.title,
      content: form.content,
      category: form.category ?? null,
      tags: parseTags(tagsText),
      pinned: form.pinned,
      projectId: form.projectId ?? null,
    });
    // The draft hook intentionally tracks the complete controlled form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isNew, tagsText]);

  useEffect(() => {
    if (!titleInputRef.current) return;
    resizeTitleInput(titleInputRef.current);
  }, [form.title]);

  const set = <K extends keyof NoteForm>(key: K, value: NoteForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const submit = async () => {
    const result = noteFormSchema.safeParse({ ...form, tags: parseTags(tagsText) });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Revisa los datos e inténtalo de nuevo.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      if (note) {
        const payload = collaboratorEditing
          ? {
              title: result.data.title,
              content: result.data.content,
              category: result.data.category,
              tags: result.data.tags,
            }
          : result.data;
        await mutations.update.mutateAsync({ id: note.id, payload });
        toast.success("Nota actualizada");
      } else {
        await mutations.create.mutateAsync(result.data);
        await draft.discard();
        toast.success("Nota creada");
      }
      router.replace(returnTo);
    } catch {
      setError("No pudimos guardar la nota. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!note || saving || collaboratorEditing) return;
    setSaving(true);
    try {
      await mutations.remove.mutateAsync(note.id);
      toast.success("Nota eliminada");
      router.replace(returnTo);
    } catch {
      setError("No pudimos borrar la nota. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === form.projectId);
  const categorySuggestions = (facetsQuery.data?.categories ?? [])
    .map((facet) => facet.name)
    .filter((category) => category.includes((form.category ?? "").trim().toLowerCase()))
    .slice(0, 6);
  const currentTagDraft = tagsText.split(",").at(-1)?.trim().toLowerCase() ?? "";
  const selectedTags = new Set(parseTags(tagsText));
  const tagSuggestions = (facetsQuery.data?.tags ?? [])
    .map((facet) => facet.name)
    .filter((tag) => !selectedTags.has(tag) && tag.includes(currentTagDraft))
    .slice(0, 6);
  const contentLength = form.content.length;
  const hasChanges = isNew
    ? Boolean(form.title || form.content || form.category || tagsText || form.pinned || form.projectId)
    : form.title !== note.title ||
      form.content !== note.content ||
      (form.category ?? "") !== (note.category ?? "") ||
      tagsText !== note.tags.join(", ") ||
       form.pinned !== note.pinned ||
       form.collaboratorsCanEdit !== note.collaboratorsCanEdit ||
       form.projectId !== note.projectId;
  const goBack = () => {
    if (!isNew && hasChanges) {
      setConfirmLeave(true);
      return;
    }
    router.push(returnTo);
  };

  if (note && user && !isOwner && !note.collaboratorsCanEdit) {
    return <EditorMessage message="Solo la persona propietaria puede editar esta nota." onBack={goBack} title="Edición no disponible" />;
  }

  return (
    <OfficialPage className="official-note-editor">
      <OfficialHeader eyebrow="MIS NOTAS" title={note ? form.title || "Editar nota" : "Nueva nota"} description={<span>Mis notas / {isNew ? "Borrador" : "Editar"}{isNew && draft.state === "saved" ? " · Borrador guardado" : hasChanges ? " · Cambios sin guardar" : ""}</span>} actions={<><button className="official-button" onClick={goBack}>Cancelar</button><button className="official-button" data-primary disabled={saving} onClick={() => void submit()}><Save size={16}/>{saving ? "Guardando…" : note ? "Guardar cambios" : "Guardar nota"}</button></>}/>
      <div className="official-split">
        <main className="official-panel min-h-[732px]">
          {draftRestored && restoredAt && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-fixed px-4 py-3 font-body-sm text-body-sm text-on-primary-fixed">
              <span>Se restauró tu borrador de {formatDraftTime(restoredAt.toISOString())}.</span>
              <button
                className="rounded-lg px-2 py-1 font-label-md text-label-md font-semibold text-primary hover:bg-primary-fixed-dim"
                onClick={() => {
                  setForm(emptyForm(defaultProjectId));
                  setTagsText("");
                  setRestoredAt(null);
                  setDraftRestored(false);
                  void draft.discard();
                }}
                type="button"
              >
                Descartar
              </button>
            </div>
          )}

          <div className="mb-6 flex items-start gap-3">
            <FileText className="mt-2 shrink-0 text-primary" size={22} />
            <textarea
              aria-label="Título de la nota"
              autoFocus
              className="block max-h-28 min-h-0 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 text-2xl font-semibold leading-8 text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:ring-0 [overflow-wrap:anywhere] sm:text-3xl sm:leading-9"
              maxLength={200}
              onChange={(event) => {
                set("title", event.target.value);
                resizeTitleInput(event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Título de la nota"
              ref={titleInputRef}
              rows={1}
              value={form.title}
              wrap="soft"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-5">
              <div>
                <p className="font-label-caps text-label-caps text-on-surface-variant">CONTENIDO</p>
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Escribe con Markdown y revisa la vista previa cuando quieras.</p>
              </div>
              <span className="font-data-mono text-data-mono text-[11px] text-on-surface-variant">{contentLength.toLocaleString("es-CO")} caracteres</span>
            </div>
            <div className="p-3 sm:p-5">
              <MarkdownEditor maxHeight="min(68vh, 42rem)" minHeight="clamp(22rem, 52vh, 34rem)" onChange={(content) => set("content", content)} placeholder="Empieza a escribir tu nota..." value={form.content} />
            </div>
          </div>
        </main>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <FolderOpen className="text-primary" size={17} />
              <h2 className="font-headline-xs text-headline-xs font-semibold text-on-surface">Organizar nota</h2>
            </div>
            <label className="block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">PROYECTO</span>
              <select
                className="field mt-1"
                 disabled={projectsQuery.isLoading || !isOwner}
                onChange={(event) => set("projectId", event.target.value || null)}
                value={form.projectId ?? ""}
              >
                <option value="">Sin proyecto</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              {selectedProject && <span className="mt-1 block font-data-mono text-data-mono text-[11px] text-on-surface-variant">Compartida en {selectedProject.name}</span>}
            </label>
            <label className="mt-4 block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">CATEGORÍA</span>
              <div className="relative">
                <input
                  aria-autocomplete="list"
                  aria-controls="note-category-suggestions"
                  aria-expanded={autocompleteOpen === "category" && categorySuggestions.length > 0}
                  className="field mt-1"
                  maxLength={60}
                  onBlur={() => window.setTimeout(() => setAutocompleteOpen(null), 100)}
                onChange={(event) => {
                    set("category", event.target.value || undefined);
                    setAutocompleteOpen("category");
                  }}
                  onFocus={() => setAutocompleteOpen("category")}
                  placeholder="Ej: investigación"
                  role="combobox"
                  value={form.category ?? ""}
                />
                {autocompleteOpen === "category" && categorySuggestions.length > 0 && (
                  <FacetSuggestions id="note-category-suggestions" items={categorySuggestions} onSelect={(category) => { set("category", category); setAutocompleteOpen(null); }} />
                )}
              </div>
            </label>
            <label className="mt-4 block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">ETIQUETAS</span>
              <div className="relative">
                <input
                  aria-autocomplete="list"
                  aria-controls="note-tag-suggestions"
                  aria-expanded={autocompleteOpen === "tags" && tagSuggestions.length > 0}
                  className="field mt-1"
                  onBlur={() => window.setTimeout(() => setAutocompleteOpen(null), 100)}
                  onChange={(event) => { setTagsText(event.target.value); setError(""); setAutocompleteOpen("tags"); }}
                  onFocus={() => setAutocompleteOpen("tags")}
                  placeholder="ideas, recursos"
                  role="combobox"
                  value={tagsText}
                />
                {autocompleteOpen === "tags" && tagSuggestions.length > 0 && (
                  <FacetSuggestions
                    id="note-tag-suggestions"
                    items={tagSuggestions}
                    onSelect={(tag) => {
                      const previous = tagsText.split(",").slice(0, -1).map((item) => item.trim()).filter(Boolean);
                      setTagsText(`${[...previous, tag].join(", ")}, `);
                      setError("");
                    }}
                  />
                )}
              </div>
              <span className="mt-1 block font-body-sm text-body-sm text-on-surface-variant">Sepáralas con comas.</span>
            </label>
              <button
                aria-checked={Boolean(form.pinned)}
                className="mt-5 flex w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-fixed/40 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isOwner}
                onClick={() => set("pinned", !form.pinned)}
              role="switch"
              type="button"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${form.pinned ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                <Pin fill={form.pinned ? "currentColor" : "none"} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-label-md text-label-md font-semibold text-on-surface">Nota fijada</span>
                <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">{form.pinned ? "Aparecerá primero en tus notas." : "Fíjala para encontrarla más rápido."}</span>
              </span>
              <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full p-1 transition-colors ${form.pinned ? "bg-primary" : "bg-surface-container-highest"}`}>
                <span className={`block h-4 w-4 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${form.pinned ? "translate-x-5" : "translate-x-0"}`} />
              </span>
              </button>
              {isOwner && (
                <button
                  aria-checked={Boolean(form.collaboratorsCanEdit)}
                  className="mt-3 flex w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-fixed/40"
                  onClick={() => set("collaboratorsCanEdit", !form.collaboratorsCanEdit)}
                  role="switch"
                  type="button"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${form.collaboratorsCanEdit ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                    <FolderOpen size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-label-md text-label-md font-semibold text-on-surface">Permitir edición colaborativa</span>
                    <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">{form.collaboratorsCanEdit ? "Los miembros del proyecto pueden editar el contenido." : "Solo tú puedes editar esta nota."}</span>
                  </span>
                  <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full p-1 transition-colors ${form.collaboratorsCanEdit ? "bg-primary" : "bg-surface-container-highest"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${form.collaboratorsCanEdit ? "translate-x-5" : "translate-x-0"}`} />
                  </span>
                </button>
              )}
          </section>

           {note && isOwner && (
            <section className="rounded-2xl border border-error/25 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-container text-error">
                  <Trash2 size={17} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-headline-xs text-headline-xs font-semibold text-on-surface">Eliminar nota</h2>
                  <p className="mt-1 font-body-sm text-body-sm leading-5 text-on-surface-variant">Esta acción es permanente y no se puede deshacer.</p>
                </div>
              </div>
              {!confirmDelete ? (
                <button className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-error/40 px-3 font-label-md text-label-md font-semibold text-error transition-colors hover:bg-error-container/60" onClick={() => setConfirmDelete(true)} type="button">
                  <Trash2 size={15} /> Eliminar nota
                </button>
              ) : (
                <div className="mt-4 rounded-xl bg-error-container/50 p-3">
                  <p className="font-body-sm text-body-sm font-semibold text-on-error-container">¿Eliminar esta nota definitivamente?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-error px-3 font-label-md text-label-md font-semibold text-error-foreground disabled:cursor-wait disabled:opacity-60" disabled={saving} onClick={() => void remove()} type="button"><Trash2 size={14} /> Eliminar definitivamente</button>
                    <button className="min-h-10 rounded-lg px-3 font-label-md text-label-md text-on-error-container hover:bg-error-container" onClick={() => setConfirmDelete(false)} type="button">Cancelar</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {error && (
        <div className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-xl rounded-xl border border-error bg-error-container px-4 py-3 font-body-sm text-body-sm text-on-error-container shadow-lg sm:inset-x-auto sm:bottom-6">
          {error}
        </div>
      )}
      {confirmLeave && (
        <ConfirmModal
          cancelLabel="Seguir editando"
          confirmLabel="Salir sin guardar"
          danger
          message={<>Tienes cambios sin guardar en esta nota. Si sales ahora, perderás esos cambios.</>}
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            router.push(returnTo);
          }}
          title="¿Salir del editor?"
        />
      )}
    </OfficialPage>
  );
}
