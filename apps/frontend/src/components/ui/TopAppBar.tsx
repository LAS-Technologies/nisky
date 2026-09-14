"use client";

import { AlarmClock, Bell, CalendarClock, ChevronRight, ListTodo, LogOut, Menu, Settings, StickyNote, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { useRemindersQuery, usePendingRemindersQuery } from "@/features/reminders/hooks/useReminders";
import { InvitationsPanel } from "@/features/projects/components/InvitationsPanel";
import { useTasksQuery } from "@/features/tasks/hooks/useTasks";
import { useQuickNotesQuery } from "@/features/quicknotes/hooks/useQuickNotes";
import { useProjectQuery } from "@/features/projects/hooks/useProjects";
import { PomodoroHeader } from "@/components/ui/FloatingPomodoro";
import type { QuickNote, Reminder, Task } from "@/types/entities";

const OPEN_PENDING_EVENT = "nisky:open-pending-reminders";
type OpenPanel = "invitations" | "notifications" | "profile" | null;

const titles: Record<string, string> = {
  "/": "Inicio",
  "/tasks": "Tareas",
  "/projects": "Proyectos",
  "/events": "Eventos",
  "/timeblocks": "Agenda",
  "/focus": "Modo enfoque",
  "/journal": "Diario",
  "/knowledge": "Mis notas",
  "/quick-notes": "Capturas rápidas",
  "/reminders": "Recordatorios",
  "/settings": "Ajustes",
  "/support": "Ayuda",
};

export function TopAppBar({ onMenu, onOpenCapture }: { onMenu: () => void; onOpenCapture: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const remindersQuery = useRemindersQuery();
  const pendingQuery = usePendingRemindersQuery();
  const tasksQuery = useTasksQuery({ limit: 20, sort: "dueDate", order: "asc" });
  const quickNotesQuery = useQuickNotesQuery("INBOX", 50);
  const projectId = pathname.startsWith("/projects/") ? pathname.split("/")[2] ?? null : null;
  const projectQuery = useProjectQuery(projectId);
  const title = projectId ? projectQuery.data?.name ?? "Proyecto" : titles[pathname] ?? "Nisky";
  const pending = pendingQuery.data ?? [];
  const notices = buildNotices(tasksQuery.data?.data ?? [], remindersQuery.data ?? [], pending, quickNotesQuery.data ?? []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-container-padding lg:px-8">
      <div className="flex items-center gap-element-gap-sm">
        <div className="flex items-center gap-element-gap-md">
          <button aria-label="Abrir menú" className="hidden rounded-md p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary sm:flex lg:hidden" onClick={onMenu} type="button"><Menu size={20} /></button>
          <Link aria-label="Ir a Inicio" className="font-headline-lg text-headline-lg font-bold tracking-tight text-primary hover:underline lg:hidden" href="/">Nisky</Link>
        </div>
        <PomodoroHeader />
      </div>
      <div className="hidden flex-1 md:block" />
      <h2 className="absolute left-1/2 hidden -translate-x-1/2 font-headline-sm text-headline-sm font-bold text-on-surface lg:block">{title}</h2>
       <div className="ml-auto flex items-center gap-element-gap-sm">
         <button
          aria-label="Nueva nota rápida"
           className="hidden items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary lg:flex"
          onClick={onOpenCapture}
          title="Nueva nota rápida (Alt+N)"
          type="button"
        >
          <StickyNote size={15} />
          Nota
           <kbd className="font-data-mono text-data-mono text-[10px] text-on-surface-variant">Alt+N</kbd>
         </button>
           <InvitationsPanel open={openPanel === "invitations"} onOpenChange={(open) => setOpenPanel(open ? "invitations" : null)} />
           <div className="relative">
              <button aria-expanded={openPanel === "notifications"} aria-label={`Notificaciones${notices.length > 0 ? ` (${notices.length})` : ""}`} className="relative rounded-md p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => setOpenPanel((panel) => panel === "notifications" ? null : "notifications")} type="button">
             <Bell size={19} />
            {pending.length > 0 && <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-error" />}
            {notices.length > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-data-mono text-[10px] text-on-primary">{notices.length > 9 ? "9+" : notices.length}</span>}
          </button>
            {openPanel === "notifications" && <NotificationPanel notices={notices} onClose={() => setOpenPanel(null)} onOpen={(url, kind) => { setOpenPanel(null); if (kind === "pending") { window.dispatchEvent(new CustomEvent(OPEN_PENDING_EVENT)); return; } router.push(url); }} />}
         </div>
         <div className="relative">
           <button aria-expanded={openPanel === "profile"} aria-label="Perfil" className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => setOpenPanel((panel) => panel === "profile" ? null : "profile")} type="button"><Avatar avatarUrl={user?.avatarUrl} email={user?.email} name={user?.name} size="sm" /></button>
           {openPanel === "profile" && (
             <>
               <button aria-label="Cerrar menú de perfil" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenPanel(null)} type="button" />
              <div className="fixed inset-x-4 top-16 z-50 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-left shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56">
                <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                  <Avatar avatarUrl={user?.avatarUrl} email={user?.email} name={user?.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-body-md text-body-md font-semibold">{user?.name ?? "Usuario"}</p>
                    <p className="truncate font-data-mono text-data-mono text-xs text-on-surface-variant">{user?.email}</p>
                  </div>
                </div>
                 <button className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low hover:text-primary" onClick={() => { setOpenPanel(null); router.push("/settings"); }} type="button"><Settings size={16} /> Ajustes</button>
                 <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-error" onClick={() => { setOpenPanel(null); void logout(); }} type="button"><LogOut size={16} /> Cerrar sesión</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

type Notice = { id: string; kind: "task" | "reminder" | "pending" | "quick"; title: string; detail: string; url: string };

function calendarDay(value: string) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDifference(value: string) {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((calendarDay(value).getTime() - current) / 86_400_000);
}

function taskDueLabel(task: Task) {
  const difference = dayDifference(task.dueDate!);
  if (difference < 0) return "Tarea vencida";
  if (difference === 0) return "Vence hoy";
  if (difference === 1) return "Vence mañana";
  return "Vence pronto";
}

function reminderUrl(reminder: Reminder) {
  if (reminder.payload?.taskId) return `/tasks?taskId=${encodeURIComponent(reminder.payload.taskId)}`;
  return "/reminders";
}

function buildNotices(tasks: Task[], reminders: Reminder[], pending: Reminder[], quickNotes: QuickNote[]) {
  const pendingNotices: Notice[] = pending.map((reminder) => ({
    id: `pending-${reminder.id}`,
    kind: "pending" as const,
    title: reminder.title,
    detail: `Pendiente · venció el ${new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(reminder.triggerAt))}`,
    url: "/reminders",
  }));
  const quickNotesNotices: Notice[] =
    quickNotes.length > 0
      ? [{
          id: "quick-notes",
          kind: "quick" as const,
          title: `Capturas rápidas sin revisar (${quickNotes.length})`,
          detail: quickNotes.length === 1 ? "Pendiente de revisar" : "Pendientes de revisar, archivar o convertir en tareas",
          url: "/quick-notes",
        }]
      : [];
  const taskNotices: Notice[] = tasks
    .filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED" && task.dueDate && dayDifference(task.dueDate) <= 2)
    .map((task) => ({ id: `task-${task.id}`, kind: "task" as const, title: task.title, detail: taskDueLabel(task), url: `/tasks?taskId=${encodeURIComponent(task.id)}` }));
  const reminderNotices: Notice[] = reminders.slice(0, 10).map((reminder) => ({
    id: `reminder-${reminder.id}`,
    kind: "reminder" as const,
    title: reminder.title,
    detail: `Recordatorio · ${new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(reminder.triggerAt))}`,
    url: reminderUrl(reminder),
  }));
  return [...pendingNotices, ...quickNotesNotices, ...taskNotices, ...reminderNotices].slice(0, 9);
}

function NotificationPanel({ notices, onClose, onOpen }: { notices: Notice[]; onClose: () => void; onOpen: (url: string, kind: Notice["kind"]) => void }) {
  return (
    <div className="fixed inset-x-4 top-16 z-50 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-left shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]">
      <div className="flex items-center justify-between border-b border-outline-variant pb-3">
        <div>
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">AVISOS</p>
          <h3 className="mt-1 font-headline-xs text-headline-xs">Para tenerlo presente</h3>
        </div>
        <button aria-label="Cerrar avisos" className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" onClick={onClose} type="button"><X size={16} /></button>
      </div>
      {notices.length === 0 ? (
        <p className="px-1 py-5 font-body-sm text-body-sm text-on-surface-variant">No tienes avisos pendientes.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant pr-1 [scrollbar-gutter:stable]">
          {notices.map((notice) => (
            <button className="flex w-full items-start gap-3 rounded-md px-2 py-3 text-left hover:bg-surface-container-low" key={notice.id} onClick={() => onOpen(notice.url, notice.kind)} type="button">
              <span className={`mt-0.5 shrink-0 ${notice.kind === "pending" ? "text-error" : notice.kind === "quick" ? "text-tertiary" : "text-primary"}`}>{notice.kind === "task" ? <ListTodo size={16} /> : notice.kind === "quick" ? <StickyNote size={16} /> : <AlarmClock size={16} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-body-sm text-body-sm text-on-surface">{notice.title}</span><span className="mt-0.5 flex items-center gap-1 font-data-mono text-data-mono text-xs text-on-surface-variant">{notice.kind === "task" ? <CalendarClock size={11} /> : null}{notice.detail}</span></span>
              <ChevronRight className="mt-0.5 shrink-0 text-on-surface-variant" size={15} />
            </button>
          ))}
        </div>
      )}
      <button className="mt-3 flex w-full items-center justify-center rounded-md border-t border-outline-variant px-2 pt-3 font-body-sm text-body-sm text-primary hover:bg-surface-container-low hover:underline" onClick={() => onOpen("/reminders", "reminder")} type="button">Ver recordatorios</button>
    </div>
  );
}
