"use client";

import { Suspense, useDeferredValue, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ProjectFormDialog } from "@/features/projects/components/ProjectFormDialog";
import { ProjectInvitationsDialog } from "@/features/projects/components/ProjectInvitationsDialog";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FAB } from "@/components/ui/FAB";
import { useAuth } from "@/context/AuthProvider";
import { CommentThread } from "@/features/comments/CommentThread";
import { MembersPanel } from "@/features/projects/components/MembersPanel";
import { ProjectActivityTimeline } from "@/features/projects/components/ProjectActivityTimeline";
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
  const [taskMode, setTaskMode] = useState<ProjectTaskMode>("ALL");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority | "ALL">("ALL");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueFrom, setTaskDueFrom] = useState("");
  const [taskDueTo, setTaskDueTo] = useState("");
  const [previewingTask, setPreviewingTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resourceFormOpen, setResourceFormOpen] = useState(false);
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
      status: taskMode === "ALL" ? undefined : taskMode === "MINE" || taskMode === "ACTIVE" ? ["PENDING", "IN_PROGRESS"] : [taskMode],
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
    return <div className="flex h-full items-center justify-center bg-[#f8fafe] text-[13px] text-[#5f6872]">{projectQuery.isLoading ? "Cargando proyecto..." : "El proyecto no existe o no tienes acceso."}</div>;
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

  const openEditProject = () => setEditOpen(true);

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
       <ProjectHeader project={project} canEdit={permissions.canEditProject} canDelete={permissions.canDeleteProject} onEdit={openEditProject} onDelete={() => setConfirmDelete(true)}
         subtitle={{ overview: "Un espacio compartido para avanzar con intención.", tasks: "Tareas y prioridades del equipo.", notes: "Decisiones e ideas en su contexto.", resources: "Enlaces y materiales que nos ayudan a avanzar.", activity: "El recorrido del proyecto, en un solo lugar.", team: "Personas que comparten este objetivo.", chat: "Comparte avances sin perder el contexto." }[activeTab]}
         action={activeTab === "overview" && permissions.canEditProject ? <button className="project-button" data-primary="true" onClick={openEditProject}>Editar proyecto</button>
           : activeTab === "tasks" && permissions.canCreateTasks ? <button className="project-button" data-primary="true" disabled={taskMutations.create.isPending} onClick={openCreateTask}>Nueva tarea</button>
           : activeTab === "notes" ? <button className="project-button" data-primary="true" onClick={() => router.push(`/knowledge/new?projectId=${encodeURIComponent(project.id)}&returnTo=${encodeURIComponent(pathname+"?tab=notes")}`)}>Nueva nota</button>
           : activeTab === "resources" ? <button className="project-button" data-primary="true" onClick={() => setResourceFormOpen(true)}>Añadir recurso</button>
           : activeTab === "team" && permissions.canManageMembers ? <button className="project-button" data-primary="true" onClick={() => setInviteOpen(true)}>Invitar persona</button> : undefined} />
       <ProjectSectionNav activeTab={activeTab} onNavigate={(tab) => navigateToTab(tab)} />

      <main className="min-h-0 min-w-0 max-w-full flex-1">
        {activeTab === "overview" && <ProjectOverview isError={summaryQuery.isError} onOpenTask={openTask} onOpenTasks={() => navigateToTab("tasks")} onRetry={() => void summaryQuery.refetch()} summary={summary ?? null} />}
        {activeTab === "tasks" && (
          <div>
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
          </div>
        )}
        {activeTab === "notes" && <ProjectNotes project={project} />}
        {activeTab === "activity" && <ProjectActivityContent projectId={project.id} />}
        {activeTab === "team" && <MembersPanel project={project} />}
        {activeTab === "chat" && <section className="project-split project-split-narrow"><div className="project-panel project-card project-chat"><h2>Conversación del proyecto</h2><CommentThread kind="project" id={project.id} /></div><aside className="project-panel project-card"><h2>En contexto</h2><p className="font-semibold mb-4">{project.name}</p><p className="project-small mb-4">{members.length} personas en el proyecto</p><hr className="border-outline-variant mb-4" /><p className="project-eyebrow">PRÓXIMO PASO</p>{summary?.upcomingTasks[0] ? <button className="project-row" onClick={() => openTask(summary.upcomingTasks[0])}>{summary.upcomingTasks[0].title}</button> : <p className="project-muted mt-4">Sin tareas próximas.</p>}</aside></section>}
        {activeTab === "resources" && <ProjectResources project={project} formOpen={resourceFormOpen} onFormOpenChange={setResourceFormOpen} />}
      </main>

      {activeTab === "tasks" && (
        <div className="sm:hidden">
           <FAB ariaLabel="Nueva tarea" loading={taskMutations.create.isPending} onClick={openCreateTask} />
         </div>
       )}
       {previewingTask && <TaskDetailsPanel key={previewingTask.id} onAddSubtask={async (taskId, title) => { await taskMutations.addSubtask.mutateAsync({ taskId, title }); }} onClose={() => setPreviewingTask(null)} onDelete={async (taskId) => { await taskMutations.remove.mutateAsync(taskId); }} onDeleteSubtask={async (taskId, subtaskId) => { await taskMutations.removeSubtask.mutateAsync({ taskId, subtaskId }); }} onStartPomodoro={() => router.push(`/focus?taskId=${encodeURIComponent(previewingTask.id)}&projectId=${encodeURIComponent(project.id)}`)} onToggleSubtask={async (taskId, subtaskId, completed) => { await taskMutations.toggleSubtask.mutateAsync({ taskId, subtaskId, completed }); }} onUpdateDescription={async (taskId, description) => { await taskMutations.update.mutateAsync({ id: taskId, payload: { description: description || null } }); }} onUpdateTask={async (taskId, payload) => { await taskMutations.update.mutateAsync({ id: taskId, payload }); }} onUpdateSubtask={async (taskId, subtaskId, title) => { await taskMutations.updateSubtask.mutateAsync({ taskId, subtaskId, payload: { title } }); }} task={previewingTask} />}
      {editOpen && <ProjectFormDialog project={project} onClose={() => setEditOpen(false)} onSave={payload => projectMutations.update.mutateAsync({ id: project.id, payload })} />}
      {inviteOpen && <ProjectInvitationsDialog open onOpenChange={setInviteOpen} project={project} />}
      {confirmDelete && <ConfirmModal cancelLabel="Cancelar" confirmLabel="Eliminar" danger loading={projectMutations.remove.isPending} message={<>¿Eliminar <strong>{project.name}</strong>? Sus tareas se moverán al proyecto personal y esta acción no se puede deshacer.</>} onClose={() => setConfirmDelete(false)} onConfirm={() => void removeProject()} title="¿Eliminar proyecto?" />}
    </ProjectWorkspaceShell>
  );
}

function ProjectActivityContent({ projectId }: { projectId: string }) {
  const query = useProjectActivity(projectId);
  if (query.isLoading) return <div className="project-panel h-72 animate-pulse" />;
  if (query.isError) return <div className="project-panel flex min-h-56 items-center justify-center text-[13px] text-[#c73b52]">No pudimos cargar la actividad del proyecto.</div>;
  return <section className="project-panel project-card min-h-[564px]"><h2>Actividad reciente</h2><ProjectActivityTimeline activities={query.data?.data ?? []} /></section>;
}

export default function ProjectDetailPage() {
  return <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#f7f7f5] text-[13px] text-[#5f6872]">Cargando proyecto...</div>}><ProjectDetailPageContent /></Suspense>;
}
