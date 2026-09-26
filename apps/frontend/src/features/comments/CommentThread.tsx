"use client";

import { MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuth } from "@/context/AuthProvider";
import { sendPresence } from "@/lib/socket";
import type { Comment } from "@/types/entities";
import { listProjectComments, listTaskComments } from "./api";
import { useCommentMutations, useProjectComments, useTaskComments } from "./hooks/useComments";

const PAGE_SIZE = 50;

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  return `hace ${days} d`;
}

function CommentSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div className="flex gap-3" key={row}>
          <span className="h-8 w-8 shrink-0 animate-pulse rounded-full border border-outline-variant bg-surface-container-high" />
          <div className="min-w-0 flex-1 space-y-1.5 py-1">
            <span className="block h-2.5 w-1/4 animate-pulse rounded-sm bg-surface-container-high" />
            <span className="block h-2.5 w-3/4 animate-pulse rounded-sm bg-surface-container-high" />
            <span className="block h-2.5 w-1/2 animate-pulse rounded-sm bg-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommentThread({ kind, id, projectId }: { kind: "project" | "task"; id: string; projectId?: string | null }) {
  const { user } = useAuth();
  const projectQuery = useProjectComments(kind === "project" ? id : null, { order: "desc", limit: PAGE_SIZE });
  const taskQuery = useTaskComments(kind === "task" ? id : null, { order: "desc", limit: PAGE_SIZE });
  const query = kind === "project" ? projectQuery : taskQuery;
  const { create, update, remove } = useCommentMutations();
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [olderAsc, setOlderAsc] = useState<Comment[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const newestCommentId = useRef<string | null>(null);
  const nextOlderPage = useRef(2);
  const shouldScrollToBottom = useRef(false);
  const restoreScroll = useRef<{ top: number; height: number } | null>(null);

  const presenceProjectId = kind === "project" ? id : (projectId ?? null);
  const presenceTaskId = kind === "task" ? id : null;

  useEffect(() => {
    sendPresence(presenceProjectId ?? "", presenceTaskId ?? null, true);
    return () => sendPresence(presenceProjectId ?? "", presenceTaskId ?? null, false);
  }, [presenceProjectId, presenceTaskId]);

  useEffect(() => {
    // Clear locally fetched older pages when switching between entities.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOlderAsc([]);
    newestCommentId.current = null;
    nextOlderPage.current = 2;
    restoreScroll.current = null;
  }, [kind, id]);

  const newest = query.data?.data ?? [];
  const baseAsc = [...newest].reverse();
  const comments = [...olderAsc, ...baseAsc];
  const total = query.data?.meta.totalItems ?? 0;
  const hasMore = comments.length < total;

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useLayoutEffect(() => {
    const previous = restoreScroll.current;
    if (!previous || !listRef.current) return;
    listRef.current.scrollTop = previous.top + (listRef.current.scrollHeight - previous.height);
    restoreScroll.current = null;
  }, [olderAsc.length]);

  const latestCommentId = baseAsc[baseAsc.length - 1]?.id ?? null;
  useEffect(() => {
    if (query.isLoading) return;
    const latestChanged = latestCommentId !== newestCommentId.current;
    if (shouldScrollToBottom.current || latestChanged) scrollToBottom();
    shouldScrollToBottom.current = false;
    newestCommentId.current = latestCommentId;
  }, [latestCommentId, query.isLoading]);

  const loadOlder = async () => {
    if (loadingOlder) return;
    const page = nextOlderPage.current;
    setLoadingOlder(true);
    try {
      const result = kind === "project"
        ? await listProjectComments(id, { order: "desc", limit: PAGE_SIZE, page })
        : await listTaskComments(id, { order: "desc", limit: PAGE_SIZE, page });
      const older = [...result.data].reverse();
      if (older.length > 0) {
        const el = listRef.current;
        restoreScroll.current = { top: el?.scrollTop ?? 0, height: el?.scrollHeight ?? 0 };
        nextOlderPage.current += 1;
        setOlderAsc((prev) => [...older, ...prev]);
      }
    } catch {
      toast.error("Ups, no pudimos cargar mensajes anteriores.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleCreate = async () => {
    const body = newBody.trim();
    if (!body || create.isPending) return;
    shouldScrollToBottom.current = true;
    try {
      await create.mutateAsync({ kind, id, body });
      setNewBody("");
    } catch {
      shouldScrollToBottom.current = false;
      toast.error("Ups, no pudimos publicar el comentario.");
    }
  };

  const handleUpdate = async (commentId: string) => {
    const body = editBody.trim();
    if (!body) return;
    try {
      await update.mutateAsync({ id: commentId, body });
      setEditingId(null);
    } catch {
      toast.error("Ups, no pudimos guardar el comentario.");
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await remove.mutateAsync(commentId);
      setConfirmingDeleteId(null);
      toast.success("Comentario eliminado");
    } catch {
      toast.error("Ups, no pudimos borrar el comentario.");
    }
  };

  const handleDeleteDirect = async (commentId: string) => {
    try {
      await remove.mutateAsync(commentId);
      toast.success("Comentario eliminado");
    } catch {
      toast.error("Ups, no pudimos borrar el comentario.");
    }
  };

  const deleteTarget = comments.find((comment) => comment.id === confirmingDeleteId) ?? null;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-6 pr-1" data-modal-scroll ref={listRef}>
        {query.isLoading ? (
          <CommentSkeleton />
        ) : query.isError ? <div role="alert" className="space-y-3 p-4"><p>No pudimos cargar los comentarios.</p><button className="min-h-11 rounded-md border border-outline-variant px-4" onClick={() => void query.refetch()}>Reintentar</button></div> : comments.length === 0 ? (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant p-6 text-center">
            <MessageSquare className="text-primary" size={22} />
            <p className="font-label-caps text-label-caps text-on-surface-variant">SIN COMENTARIOS</p>
            <p className="max-w-xs font-body-sm text-body-sm text-on-surface-variant">
               Aún no hay comentarios. Sé el primero en dejar una nota.
            </p>
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-outline-variant py-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:opacity-50"
                disabled={loadingOlder}
                onClick={() => void loadOlder()}
                type="button"
              >
                {loadingOlder ? "Cargando..." : `Cargar anteriores (${total - comments.length})`}
              </button>
            )}
            {comments.map((comment: Comment) => {
              const isMine = comment.author.id === user?.id;
              const editing = editingId === comment.id;
              const edited = comment.updatedAt !== comment.createdAt;
              return (
                <article
                  className="group flex min-w-0 gap-3 py-1"
                  key={comment.id}
                  onClick={(event) => {
                    if (!event.shiftKey) return;
                    const target = event.target as HTMLElement;
                    if (target.closest("button, textarea, a")) return;
                    void handleDeleteDirect(comment.id);
                  }}
                >
                  <Avatar avatarUrl={comment.author.avatarUrl} email={comment.author.email} name={comment.author.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-body-sm text-body-sm font-medium">
                        {comment.author.name ?? comment.author.email}
                      </span>
                      <span className="shrink-0 font-data-mono text-data-mono text-[11px] text-on-surface-variant">{timeAgo(comment.createdAt)}</span>
                      {edited && (
                        <span className="shrink-0 font-data-mono text-data-mono text-[11px] text-on-surface-variant" title={`Editado ${timeAgo(comment.updatedAt)}`}>
                          · editado
                        </span>
                      )}
                      {isMine && !editing && (
                        <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            aria-label="Editar comentario"
                            className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditBody(comment.body);
                            }}
                            title="Editar"
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label="Eliminar comentario"
                            className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                            onClick={(event) => {
                              if (event.shiftKey) {
                                event.stopPropagation();
                                void handleDeleteDirect(comment.id);
                                return;
                              }
                              setConfirmingDeleteId(comment.id);
                            }}
                            title="Eliminar"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </span>
                      )}
                    </div>
                    {editing ? (
                      <div className="mt-2 space-y-2">
                        <textarea aria-label="Editar comentario" autoFocus className="field min-h-[4.5rem] py-2" onChange={(event) => setEditBody(event.target.value)} value={editBody} />
                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-body-sm text-body-sm text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-50"
                            disabled={!editBody.trim() || update.isPending}
                            onClick={() => void handleUpdate(comment.id)}
                            type="button"
                          >
                            <Send size={13} /> Guardar
                          </button>
                          <button
                            className="rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high"
                            onClick={() => {
                              setEditingId(null);
                              setEditBody("");
                            }}
                            type="button"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface">
                        {comment.body}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-outline-variant pt-4">
        <div className="flex gap-3">
          <Avatar avatarUrl={user?.avatarUrl} email={user?.email} name={user?.name} size="md" />
          <div className="min-w-0 flex-1">
            <textarea
              aria-label="Nuevo comentario"
              className="field min-h-[4.5rem] py-2"
              onChange={(event) => setNewBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="Escribe un comentario..."
              value={newBody}
            />
            <div className="mt-2 flex justify-end">
              <button
                className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-body-sm text-body-sm text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-50"
                disabled={!newBody.trim() || create.isPending}
                onClick={() => void handleCreate()}
                type="button"
              >
                <Send size={14} /> {kind === "project" ? "Enviar comentario" : "Comentar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          confirmLabel="Eliminar"
          danger
          loading={remove.isPending}
          message="El comentario se eliminará de forma permanente. Esta acción no se puede deshacer."
          onClose={() => setConfirmingDeleteId(null)}
          onConfirm={() => void handleDelete(deleteTarget.id)}
          title="¿Eliminar comentario?"
        />
      )}
    </div>
  );
}
