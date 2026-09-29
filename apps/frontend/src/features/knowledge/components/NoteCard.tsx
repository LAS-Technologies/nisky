"use client";

import { FolderKanban, Pin, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Note } from "@/types/entities";

function noteDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export function NoteCard({
  note,
  onOpen,
  onEdit,
  onTogglePin,
  canEdit = true,
  canEditContent = canEdit,
  showAuthor = false,
  project,
  projectStyle = false,
  officialStyle = false,
}: {
  note: Note;
  projectStyle?: boolean;
  officialStyle?: boolean;
  onOpen: (note: Note) => void;
  onEdit?: (note: Note) => void;
  onTogglePin: (note: Note) => Promise<void>;
  canEdit?: boolean;
  canEditContent?: boolean;
  showAuthor?: boolean;
  project?: { id: string; name: string; color: string } | null;
}) {
  if (projectStyle || officialStyle) return <article className={officialStyle ? "official-panel official-note-card" : "project-panel project-card project-list-card"}>
    <div className="flex w-full items-center justify-between gap-2"><span className={officialStyle ? "official-note-tag" : "project-tag"}>{note.pinned ? "Fijada" : note.category || "Nota"}</span>{canEdit && <button aria-label={note.pinned ? "Desfijar" : "Fijar"} className="p-2 text-primary" onClick={() => void onTogglePin(note)}><Pin size={16} /></button>}</div>
    <button aria-label={`Vista previa de ${note.title}`} className="text-left min-w-0" onClick={() => onOpen(note)}><h2>{note.title}</h2></button>
    <button className="text-left min-w-0 w-full" onClick={() => onOpen(note)}><p className={officialStyle ? "official-description line-clamp-2" : "project-muted line-clamp-2"}>{note.content}</p></button>
    <div className="flex items-center justify-between w-full gap-2"><p className={officialStyle ? "text-xs text-on-surface-variant" : "project-small"}>Editado {noteDate(note.updatedAt)}</p>{canEditContent && onEdit && <button aria-label={`Editar ${note.title}`} className="p-2 text-primary" onClick={() => onEdit(note)}><Pencil size={16} /></button>}</div>
  </article>;
  return (
    <article className="group flex min-w-0 flex-col rounded-lg border border-outline-variant/70 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <div className="flex min-w-0 items-start justify-between gap-2 p-5 pb-0">
        <button aria-label={`Vista previa de ${note.title}`} className="min-w-0 rounded-md text-left" onClick={() => onOpen(note)} type="button">
          <h2 className="line-clamp-2 min-w-0 break-words font-headline-xs text-headline-xs font-semibold text-on-surface [overflow-wrap:anywhere]">{note.title}</h2>
        </button>
        {canEdit && <button
            aria-label={note.pinned ? "Desfijar" : "Fijar"}
            className={`shrink-0 rounded-lg p-2 ${note.pinned ? "bg-secondary-fixed text-secondary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}
            onClick={() => void onTogglePin(note)}
            type="button"
          >
            <Pin size={16} fill={note.pinned ? "currentColor" : "none"} />
          </button>}
      </div>
      <button aria-label={`Vista previa de ${note.title}`} className="min-w-0 flex-1 rounded-md p-5 text-left" onClick={() => onOpen(note)} type="button">
        <p className="line-clamp-5 break-words whitespace-pre-line font-body-md text-body-md leading-relaxed text-on-surface">{note.content}</p>
      </button>
      <div className="flex items-end justify-between gap-2 px-5 pb-5 pt-0">
        <div className="min-w-0 flex-1">
          {project && (
            <div className="mb-2 flex min-w-0">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary-fixed/50 px-2 py-1 font-label-md text-label-md text-primary">
                <FolderKanban aria-hidden="true" className="shrink-0" size={13} />
                <span className="min-w-0 truncate">{project.name}</span>
              </span>
            </div>
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
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words font-data-mono text-data-mono text-[11px] text-on-surface-variant">
            {showAuthor && note.user && <span className="inline-flex min-w-0 items-center gap-1.5"><Avatar avatarUrl={note.user.avatarUrl} email={note.user.email} name={note.user.name} size="xs" /><span className="max-w-[10rem] truncate">{note.user.name ?? note.user.email}</span></span>}
            {showAuthor && note.user && <span aria-hidden="true">·</span>}
            <span>{note.category ? `${note.category} · ` : ""}{noteDate(note.updatedAt)}</span>
          </div>
        </div>
         {canEditContent && onEdit && <div className="flex shrink-0 items-center gap-1">
             <button aria-label="Abrir para editar" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => onEdit(note)} title="Editar desde la vista previa" type="button">
              <Pencil size={14} />
            </button>
          </div>}
      </div>
    </article>
  );
}
