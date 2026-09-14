"use client";

import { Suspense, useDeferredValue, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FAB } from "@/components/ui/FAB";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthProvider";
import { CommentThread } from "@/features/comments/CommentThread";
import { MembersPanel } from "@/features/projects/components/MembersPanel";
import { ProjectActivityTimeline } from "@/features/projects/components/ProjectActivityTimeline";
import { ProjectActivityPagination } from "@/features/projects/components/ProjectActivityPagination";
import { ProjectContextPanel } from "@/features/projects/components/ProjectContextPanel";
import { ProjectHeader } from "@/features/projects/components/ProjectHeader";
import { ProjectNotes } from "@/features/projects/components/ProjectNotes";
import { ProjectOverview } from "@/features/projects/components/ProjectOverview";
import { ProjectResources } from "@/features/projects/components/ProjectResources";
import { ProjectSectionNav, type ProjectVisibleTab } from "@/features/projects/components/ProjectSectionNav";
import { ProjectTaskMode, ProjectTaskWorkspace } from "@/features/projects/components/ProjectTaskWorkspace";
import { ProjectWorkspaceShell } from "@/features/projects/components/ProjectWorkspaceShell";
import { useProjectActivity, useProjectSummary } from "@/features/projects/hooks/useProjectWorkspace";
import { useProjectMembers, useProjectMutations, useProjectQuery } from "@/features/projects/hooks/useProjects";
import { TaskDetailsPanel } from "@/features/tasks/components/TaskDetailsPanel";
import { usePaginatedTasksQuery, useTaskMutations } from "@/features/tasks/hooks/useTasks";
import type { Task, TaskPriority } from "@/types/entities";

type ProjectTab = ProjectVisibleTab;

const validTabs = new Set<ProjectTab>(["overview", "tasks", "notes", "activity", "team", "chat", "resources"]);

function parseTab(value: string | null): ProjectTab {
  return value && validTabs.has(value as ProjectTab) ? (value as ProjectTab) : "overview";
}

function ProjectDetailPageContent() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const projectId = params.id;
  const projectQuery = useProjectQuery(projectId);
  const summaryQuery = useProjectSummary(projectId);
  const membersQuery = useProjectMembers(projectId);
  const projectMutations = useProjectMutations();
  const taskMutations = useTaskMutations();

  const [taskPage, setTaskPage] = useState(1);
  const [taskMode, setTaskMode] = useState<ProjectTaskMode>("ACTIVE");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority | "ALL">("ALL");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueFrom, setTaskDueFrom] = useState("");
  const [taskDueTo, setTaskDueTo] = useState("");
  const [previewingTask, setPreviewingTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editColor, setEditColor] = useState("#1e3a5f");
  const [editTargetHours, setEditTargetHours] = useState("");
  const [editTargetMinutes, setEditTargetMinutes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const creatingTaskRef = useRef(false);

  const project = projectQuery.data;
  const summary = summaryQuery.data;
  const members = summary?.members ?? membersQuery.data ?? [];
  const activeTab = parseTab(searchParams.get("tab"));
  const deferredSearch = useDeferredValue(taskSearch);
  const tasksQuery = usePaginatedTasksQuery(
    {
      projectId,
      page: taskPage,
      status: taskMode === "ALL" ? undefined : ["PENDING", "IN_PROGRESS"],
      assigneeId: taskMode === "MINE" ? user?.id : taskAssigneeId || undefined,
       priority: taskPriority === "ALL" ? undefined : taskPriority,
       q: deferredSearch.trim() || undefined,
       dueFrom: taskDueFrom || undefined,
       dueTo: taskDueTo || undefined,
        sort: "createdAt",
       order: "desc",
    },
    { enabled: activeTab === "tasks", pageSize: 10 },
  );

  if (!project) {
    return <div className="flex h-full items-center justify-center bg-[#f7f7f5] text-[13px] text-[#5f6872]">{projectQuery.isLoading ? "Cargando proyecto..." : "El proyecto no existe o no tienes acceso."}</div>;
  }

  const navigateToTab = (nextTab: ProjectTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextTab === "overview") nextParams.delete("tab");
    else nextParams.set("tab", nextTab);
    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const resetTaskPage = () => setTaskPage(1);
  const openTask = (task: Task) => { setPreviewingTask(task); };
  const createTaskAndOpen = async () => {
    if (creatingTaskRef.current) return;
    creatingTaskRef.current = true;
    try {
      const created = await taskMutations.create.mutateAsync({
        title: "Nueva tarea",
        status: "PENDING",
        priority: "NORMAL",
        pomodoroEstimate: 0,
        projectId: project.id,
      });
      setPreviewingTask(created);
      toast.success("Tarea creada en el proyecto");
    } catch {
      toast.error("No pudimos crear la tarea. Inténtalo de nuevo.");
    } finally {
      creatingTaskRef.current = false;
    }
  };
  const openCreateTask = () => {
    setPreviewingTask(null);
    void createTaskAndOpen();
  };
  const saveProjectDescription = async (description: string) => {
    await projectMutations.update.mutateAsync({ id: project.id, payload: { description: description || null } });
  };

  const quickAdd = async (title: string) => {
    try {
      await taskMutations.create.mutateAsync({ title, status: "PENDING", priority: "NORMAL", projectId: project.id, pomodoroEstimate: 0 });
      toast.success("Tarea añadida");
    } catch {
      toast.error("No pudimos crear la tarea. Inténtalo de nuevo.");
      throw new Error("quick-add-failed");
    }
  };

  const toggleTask = async (task: Task) => {
    const wasCompleted = task.status === "COMPLETED";
    const previousStatus = task.status;
    try {
      await taskMutations.update.mutateAsync({ id: task.id, payload: { status: task.status === "COMPLETED" ? "PENDING" : "COMPLETED" } });
      if (!wasCompleted) {
        toast.success("Tarea completada", {
          action: {
            label: "Deshacer",
            onClick: () => {
              void taskMutations.update.mutateAsync({ id: task.id, payload: { status: previousStatus } }).catch(() => {
                toast.error("No pudimos deshacer el cambio.");
              });
            },
          },
        });
      } else {
        toast.success("Tarea devuelta a activas");
      }
    } catch {
      toast.error("No pudimos actualizar la tarea.");
    }
  };

  const openEditProject = () => {
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditTargetDate(project.targetDate?.slice(0, 10) ?? "");
    setEditColor(project.color);
    setEditTargetHours(project.weeklyTargetMinutes ? Math.floor(project.weeklyTargetMinutes / 60).toString() : "");
    setEditTargetMinutes(project.weeklyTargetMinutes ? (project.weeklyTargetMinutes % 60).toString() : "");
    setEditOpen(true);
  };

  const saveProject = async () => {
    try {
      const totalMinutes = (parseInt(editTargetHours, 10) || 0) * 60 + (parseInt(editTargetMinutes, 10) || 0);
      await projectMutations.update.mutateAsync({
        id: project.id,
        payload: {
          name: editName.trim(),
          description: editDescription.trim() || null,
          targetDate: editTargetDate || null,
          color: editColor,
          weeklyTargetMinutes: totalMinutes > 0 ? totalMinutes : null,
        },
      });
      setEditOpen(false);
      toast.success("Proyecto actualizado");
    } catch {
      toast.error("No pudimos guardar los cambios.");
    }
  };

  const removeProject = async () => {
    try {
      await projectMutations.remove.mutateAsync(project.id);
      toast.success("Proyecto eliminado");
      router.replace("/projects");
    } catch {
      toast.error("No pudimos eliminar el proyecto.");
      setConfirmDelete(false);
    }
  };

  const permissions = summary?.permissions ?? {
    role: project.userId === user?.id ? "OWNER" as const : "MEMBER" as const,
    canEditProject: project.userId === user?.id,
    canDeleteProject: project.userId === user?.id && !project.isDefault,
    canManageMembers: project.userId === user?.id && !project.isDefault,
    canCreateTasks: true,
    canEditTasks: true,
  };

  return (
     <ProjectWorkspaceShell>
       <ProjectHeader canDelete={permissions.canDeleteProject} canEdit={permissions.canEditProject} members={members} onBack={() => router.push("/projects")} onDelete={() => setConfirmDelete(true)} onEdit={openEditProject} onSaveDescription={saveProjectDescription} project={project} />
       <ProjectSectionNav activeTab={activeTab} onNavigate={(tab) => navigateToTab(tab)} />

      <main className="min-h-0 min-w-0 max-w-full flex-1 pb-8 pt-7">
        {activeTab === "overview" && <ProjectOverview isError={summaryQuery.isError} onOpenTask={openTask} onOpenTasks={() => navigateToTab("tasks")} onRetry={() => void summaryQuery.refetch()} summary={summary ?? null} />}
        {activeTab === "tasks" && (
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
            <ProjectTaskWorkspace
                 assigneeId={taskAssigneeId}
                dueFrom={taskDueFrom}
                dueTo={taskDueTo}
                canEditTasks={permissions.canEditTasks}
               isError={tasksQuery.isError}
              isFetching={tasksQuery.isFetching}
              isLoading={tasksQuery.isLoading}
              members={members}
              meta={tasksQuery.data?.meta}
              mode={taskMode}
                onAssigneeChange={(value) => { setTaskPage(1); setTaskAssigneeId(value); }}
                onDueFromChange={(value) => { resetTaskPage(); setTaskDueFrom(value); }}
                onDueToChange={(value) => { resetTaskPage(); setTaskDueTo(value); }}
                onModeChange={(value) => { resetTaskPage(); setTaskMode(value); }}
               onOpen={openTask}
               onUpdateTask={async (taskId, payload) => {
                 await taskMutations.update.mutateAsync({ id: taskId, payload });
               }}
               onPageChange={setTaskPage}
               onPriorityChange={(value) => { resetTaskPage(); setTaskPriority(value); }}
               onCreateTask={openCreateTask}
               onQuickAdd={quickAdd}
               onResetFilters={() => { resetTaskPage(); setTaskMode("ACTIVE"); setTaskSearch(""); setTaskPriority("ALL"); setTaskAssigneeId(""); setTaskDueFrom(""); setTaskDueTo(""); }}
              onRetry={() => void tasksQuery.refetch()}
              onSearchChange={(value) => { resetTaskPage(); setTaskSearch(value); }}
              onStartPomodoro={(task) => router.push(`/focus?taskId=${encodeURIComponent(task.id)}&projectId=${encodeURIComponent(project.id)}`)}
              onToggle={(task) => void toggleTask(task)}
              previewedTaskId={previewingTask?.id}
              priority={taskPriority}
              search={taskSearch}
              tasks={tasksQuery.data?.data ?? []}
            />
            <ProjectContextPanel isError={summaryQuery.isError} onOpenTask={openTask} onRetry={() => void summaryQuery.refetch()} summary={summary ?? null} />
          </div>
        )}
        {activeTab === "notes" && <ProjectNotes project={project} />}
        {activeTab === "activity" && <ProjectActivityContent key={project.id} projectId={project.id} />}
        {activeTab === "team" && <section className="min-w-0 max-w-3xl"><div className="mb-5"><p className="project-eyebrow">COLABORACIÓN</p><h2 className="mt-1 text-[19px] font-semibold text-[#131b2e]">Equipo del proyecto</h2><p className="mt-1 text-[13px] text-[#69758a]">Gestiona las personas que pueden trabajar con este proyecto.</p></div><div className="project-panel p-5 sm:p-6"><MembersPanel project={project} /></div></section>}
        {activeTab === "chat" && <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]"><div className="project-panel flex h-[min(42rem,calc(100dvh-12rem))] min-h-[34rem] min-w-0 flex-col overflow-hidden p-5 sm:p-6"><div className="mb-5"><p className="project-eyebrow">COLABORACIÓN</p><h2 className="mt-1 text-[19px] font-semibold text-[#131b2e]">Conversación del proyecto</h2><p className="mt-1 text-[13px] text-[#69758a]">Comparte avances sin sacar la conversación del contexto.</p></div><CommentThread kind="project" id={project.id} /></div><ProjectContextPanel isError={summaryQuery.isError} onOpenTask={openTask} onRetry={() => void summaryQuery.refetch()} summary={summary ?? null} /></section>}
        {activeTab === "resources" && <ProjectResources project={project} />}
      </main>

      {activeTab === "tasks" && (
        <div className="sm:hidden">
           <FAB ariaLabel="Nueva tarea" loading={taskMutations.create.isPending} onClick={openCreateTask} />
         </div>
       )}
       {previewingTask && <TaskDetailsPanel key={previewingTask.id} onAddSubtask={async (taskId, title) => { await taskMutations.addSubtask.mutateAsync({ taskId, title }); }} onClose={() => setPreviewingTask(null)} onDelete={async (taskId) => { await taskMutations.remove.mutateAsync(taskId); }} onDeleteSubtask={async (taskId, subtaskId) => { await taskMutations.removeSubtask.mutateAsync({ taskId, subtaskId }); }} onStartPomodoro={() => router.push(`/focus?taskId=${encodeURIComponent(previewingTask.id)}&projectId=${encodeURIComponent(project.id)}`)} onToggleSubtask={async (taskId, subtaskId, completed) => { await taskMutations.toggleSubtask.mutateAsync({ taskId, subtaskId, completed }); }} onUpdateDescription={async (taskId, description) => { await taskMutations.update.mutateAsync({ id: taskId, payload: { description: description || null } }); }} onUpdateTask={async (taskId, payload) => { await taskMutations.update.mutateAsync({ id: taskId, payload }); }} onUpdateSubtask={async (taskId, subtaskId, title) => { await taskMutations.updateSubtask.mutateAsync({ taskId, subtaskId, payload: { title } }); }} task={previewingTask} />}
      {editOpen && <EditProjectModal canRename={!project.isDefault} color={editColor} description={editDescription} name={editName} onClose={() => setEditOpen(false)} onColorChange={setEditColor} onDescriptionChange={setEditDescription} onNameChange={setEditName} onSave={() => void saveProject()} onTargetDateChange={setEditTargetDate} onTargetHoursChange={setEditTargetHours} onTargetMinutesChange={setEditTargetMinutes} targetDate={editTargetDate} targetHours={editTargetHours} targetMinutes={editTargetMinutes} />}
      {confirmDelete && <ConfirmModal cancelLabel="Cancelar" confirmLabel="Eliminar" danger loading={projectMutations.remove.isPending} message={<>¿Eliminar <strong>{project.name}</strong>? Sus tareas se moverán al proyecto personal y esta acción no se puede deshacer.</>} onClose={() => setConfirmDelete(false)} onConfirm={() => void removeProject()} title="¿Eliminar proyecto?" />}
    </ProjectWorkspaceShell>
  );
}

function ProjectActivityContent({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const query = useProjectActivity(projectId, page);
  if (query.isLoading) return <div className="project-panel h-72 animate-pulse" />;
  if (query.isError) return <div className="project-panel flex min-h-56 items-center justify-center text-[13px] text-[#c73b52]">No pudimos cargar la actividad del proyecto.</div>;
  return <section className="min-w-0 max-w-3xl"><div className="mb-5"><p className="project-eyebrow">HISTORIAL</p><h2 className="mt-1 text-[19px] font-semibold text-[#131b2e]">Actividad reciente</h2><p className="mt-1 text-[13px] text-[#69758a]">Cambios y conversaciones registrados en el proyecto.</p></div><ProjectActivityTimeline activities={query.data?.data ?? []} /><ProjectActivityPagination isFetching={query.isFetching} meta={query.data?.meta} onPageChange={setPage} /></section>;
}

function EditProjectModal({ canRename, name, description, targetDate, color, targetHours, targetMinutes, onNameChange, onDescriptionChange, onTargetDateChange, onColorChange, onTargetHoursChange, onTargetMinutesChange, onSave, onClose }: { canRename: boolean; name: string; description: string; targetDate: string; color: string; targetHours: string; targetMinutes: string; onNameChange: (value: string) => void; onDescriptionChange: (value: string) => void; onTargetDateChange: (value: string) => void; onColorChange: (value: string) => void; onTargetHoursChange: (value: string) => void; onTargetMinutesChange: (value: string) => void; onSave: () => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="top-auto bottom-0 flex h-[min(90dvh,48rem)] max-h-[90dvh] w-full max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-[#dde1e2] bg-white p-0 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl"
        data-keyboard-sheet
        keyboardAware
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-[#e7e9e8] px-5 py-4 text-left">
          <div>
            <DialogTitle className="text-[17px] font-semibold text-[#1f2933]">Editar proyecto</DialogTitle>
            <DialogDescription className="sr-only">Edita la información visible del proyecto.</DialogDescription>
          </div>
          <DialogClose asChild>
            <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-lg text-[#5f6872] hover:bg-[#eff1f0]" type="button">×</button>
          </DialogClose>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" data-modal-scroll>
          <label className="block">
            <span className="project-eyebrow">NOMBRE</span>
            <input autoFocus className="project-input mt-1 disabled:cursor-not-allowed disabled:bg-[#eff1f0]" disabled={!canRename} maxLength={100} onChange={(event) => onNameChange(event.target.value)} value={name} />
            {!canRename && <span className="mt-1 block text-[11px] text-[#858d91]">El proyecto personal no se puede renombrar.</span>}
          </label>
          <label className="block">
            <span className="project-eyebrow">DESCRIPCIÓN</span>
            <textarea className="project-input mt-1 min-h-24 resize-y py-2" maxLength={2000} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Qué contexto debe conocer el equipo..." value={description} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="project-eyebrow">FECHA OBJETIVO</span>
              <input className="project-input mt-1" onChange={(event) => onTargetDateChange(event.target.value)} type="date" value={targetDate} />
            </label>
            <div>
              <span className="project-eyebrow">COLOR</span>
              <div className="mt-1"><ColorPicker onChange={onColorChange} value={color} /></div>
            </div>
          </div>
          <div>
            <span className="project-eyebrow">META SEMANAL (OPCIONAL)</span>
            <div className="mt-1 flex items-center gap-2">
              <input aria-label="Horas de meta semanal" className="project-input w-20 text-center" maxLength={3} onChange={(event) => onTargetHoursChange(event.target.value.replace(/\D/g, ""))} placeholder="0" value={targetHours} />
              <span className="text-[13px] text-[#5f6872]">h</span>
              <input aria-label="Minutos de meta semanal" className="project-input w-20 text-center" maxLength={2} onChange={(event) => onTargetMinutesChange(event.target.value.replace(/\D/g, ""))} placeholder="0" value={targetMinutes} />
              <span className="text-[13px] text-[#5f6872]">min</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e7e9e8] p-5 pt-4">
          <DialogClose asChild>
            <button className="min-h-10 rounded-lg border border-[#dde1e2] px-3 text-[13px] font-semibold text-[#5f6872]" type="button">Cancelar</button>
          </DialogClose>
          <button className="min-h-10 rounded-lg bg-[#1e3a5f] px-4 text-[13px] font-semibold text-white hover:bg-[#152c48]" disabled={!name.trim()} onClick={onSave} type="button">Guardar cambios</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetailPage() {
  return <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#f7f7f5] text-[13px] text-[#5f6872]">Cargando proyecto...</div>}><ProjectDetailPageContent /></Suspense>;
}
