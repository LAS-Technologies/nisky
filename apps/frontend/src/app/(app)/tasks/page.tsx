"use client";

import {
  Suspense,
  useMemo,
  useState,
} from "react";
import {
  Check,
  CheckSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Project, Task, TaskPriority, TaskStatus } from "@/types/entities";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FAB } from "@/components/ui/FAB";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { archiveQuickNote } from "@/features/quicknotes/api/quicknotes";
import { BacklogPanel } from "@/features/tasks/components/BacklogPanel";
import { TaskList } from "@/features/tasks/components/TaskList";
import { TaskPagination } from "@/features/tasks/components/TaskPagination";
import { TaskCreateDialog } from "@/features/tasks/components/TaskCreateDialog";
import type { TaskPayload } from "@/features/tasks/api/tasks";
import "@/features/tasks/components/tasks.css";
import { TaskDetailsPanel } from "@/features/tasks/components/TaskDetailsPanel";
import {
  usePaginatedTasksQuery,
  useTaskMutations,
  useTaskQuery,
} from "@/features/tasks/hooks/useTasks";
import {
  useAccessibleProjects,
  useProjectsQuery,
} from "@/features/projects/hooks/useProjects";
import { localDateKey } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  TaskSelectionProvider,
  useTaskSelection,
} from "@/features/tasks/selection/TaskSelectionContext";

const emptyTasks: Task[] = [];

type TaskCreateOptions = {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  pomodoroEstimate?: number;
  projectId?: string;
};

function useModalUrl() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = {
    taskId: searchParams.get("taskId"),
    create: searchParams.get("modal") === "create",
    prefill: searchParams.get("prefill"),
    quickNoteId: searchParams.get("quickNoteId"),
  };

  const navigateWithModal = (params: URLSearchParams, replace = false) => {
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  return {
    state,
    openCreate: (options: TaskCreateOptions = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("taskId");
      params.set("modal", "create");
      params.set("prefill", JSON.stringify(options));
      navigateWithModal(params);
    },
    openTask: (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("modal");
      params.delete("prefill");
      params.delete("quickNoteId");
      params.set("taskId", taskId);
      navigateWithModal(params);
    },
    close: () => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("taskId");
      params.delete("modal");
      params.delete("prefill");
      params.delete("quickNoteId");
      navigateWithModal(params, true);
    },
    openFocus: (taskId: string, projectId?: string) => {
      const params = new URLSearchParams({ taskId });
      if (projectId) params.set("projectId", projectId);
      router.push(`/focus?${params.toString()}`);
    },
  };
}

function parsePrefill(value: string | null): TaskCreateOptions | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!parsed || typeof parsed !== "object") return undefined;
    const source = parsed as Record<string, unknown>;
    const rawDueDate = typeof source.dueDate === "string" ? source.dueDate : "";
    const rawPriority = source.priority;
    const priority =
      rawPriority === "LOW" ||
      rawPriority === "NORMAL" ||
      rawPriority === "HIGH" ||
      rawPriority === "URGENT"
        ? rawPriority
        : undefined;
    const rawPomodoroEstimate = source.pomodoroEstimate;
    const pomodoroEstimate =
      typeof rawPomodoroEstimate === "number" &&
      Number.isFinite(rawPomodoroEstimate)
        ? Math.min(100, Math.max(0, Math.trunc(rawPomodoroEstimate)))
        : undefined;
    return {
      title: typeof source.title === "string" ? source.title.trim() : "",
      description:
        typeof source.description === "string" ? source.description : undefined,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)
        ? `${rawDueDate}T23:59`
        : rawDueDate,
      priority,
      pomodoroEstimate,
      projectId:
        typeof source.projectId === "string" ? source.projectId : undefined,
    };
  } catch {
    return undefined;
  }
}

type TaskView = "list" | "backlog";

const TASK_VIEW_KEY = "nisky:task-view";
const TASK_PROJECT_FILTER_KEY = "nisky:task-filter-project";

function initialTaskView(searchView?: string | null): TaskView {
  if (searchView === "backlog") return "backlog";
  if (typeof window === "undefined") return "list";
  const value = localStorage.getItem(TASK_VIEW_KEY);
  return value === "backlog" ? "backlog" : "list";
}

function initialProjectFilter(): string | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(TASK_PROJECT_FILTER_KEY);
  return value || null;
}

function TasksPageContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "COMPLETED" | "ALL"
  >("ACTIVE");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => searchParams.get("projectId") ?? initialProjectFilter(),
  );
  const [sort, setSort] = useState<
    "priority" | "dueDate" | "createdAt" | "title"
  >("dueDate");
  const [view, setView] = useState<TaskView>(() =>
    initialTaskView(searchParams.get("view")),
  );
  const [taskPage, setTaskPage] = useState(1);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const isMobile = useIsMobile(1023);
  const selection = useTaskSelection();
  const modalUrl = useModalUrl();
  const taskStatus: TaskStatus | TaskStatus[] | undefined =
    statusFilter === "ACTIVE"
      ? ["PENDING", "IN_PROGRESS"]
      : statusFilter === "COMPLETED"
        ? "COMPLETED"
        : undefined;
  const commonQuery = {
    q: search || undefined,
    priority: priority === "ALL" ? undefined : priority,
    status: taskStatus,
    projectId: selectedProjectId ?? undefined,
    sort,
    order:
      sort === "dueDate" || sort === "createdAt"
        ? ("asc" as const)
        : ("desc" as const),
  };
  const listQuery = usePaginatedTasksQuery(
    {
      ...commonQuery,
      due: "SET",
      page: view === "list" ? taskPage : 1,
    },
    { pageSize: view === "list" ? 10 : 1 },
  );
  const backlogQuery = usePaginatedTasksQuery(
    {
      ...commonQuery,
      due: "UNSET",
      page: view === "backlog" ? taskPage : 1,
    },
    { pageSize: view === "backlog" ? 25 : 1 },
  );
  const query = view === "backlog" ? backlogQuery : listQuery;
  const urlTaskQuery = useTaskQuery(modalUrl.state.taskId);
  const mutations = useTaskMutations();
  const projectsQuery = useProjectsQuery();
  const accessibleProjectsQuery = useAccessibleProjects();
  const allProjects = useMemo(() => {
    const merged = [...(projectsQuery.data ?? [])];
    for (const project of accessibleProjectsQuery.data ?? []) {
      if (!merged.some((item) => item.id === project.id)) merged.push(project);
    }
    return merged;
  }, [projectsQuery.data, accessibleProjectsQuery.data]);
  const allTasks = query.data?.data ?? emptyTasks;
  const tasks = allTasks;
  const selectedTasks = useMemo(
    () => tasks.filter((task) => selection.selectedIds.has(task.id)),
    [tasks, selection.selectedIds],
  );
  const backlogCount = backlogQuery.data?.meta.totalItems ?? 0;
  const activeFilterCount =
    (statusFilter !== "ACTIVE" ? 1 : 0) +
    (priority !== "ALL" ? 1 : 0) +
    (selectedProjectId ? 1 : 0) +
    (sort !== "dueDate" ? 1 : 0);
  const isBulkMoveNoop = (projectId: string | null) =>
    selectedTasks.length > 0 &&
    selectedTasks.every((task) => (task.projectId ?? null) === projectId);
  const taskFromUrl =
    urlTaskQuery.data ??
    tasks.find((task) => task.id === modalUrl.state.taskId) ??
    (createdTask?.id === modalUrl.state.taskId ? createdTask : null);
  const previewOpen = Boolean(
    taskFromUrl && modalUrl.state.taskId && !modalUrl.state.create,
  );
  const taskDefaultProjectId =
    selectedProjectId ??
    projectsQuery.data?.find((project) => project.isDefault)?.id;

  const createTaskAndOpen = async (payload: TaskPayload) => {
    const created = await mutations.create.mutateAsync(payload);
    setCreatedTask(created);
    if (modalUrl.state.quickNoteId) {
      try { await archiveQuickNote(modalUrl.state.quickNoteId); }
      catch { toast.warning("La tarea se creó, pero no pudimos archivar la captura original."); }
    }
    modalUrl.openTask(created.id);
    return created;
  };

  const setTaskView = (next: TaskView) => {
    setTaskPage(1);
    selection.clear();
    setView(next);
    localStorage.setItem(TASK_VIEW_KEY, next);
  };

  const setTaskSearch = (value: string) => {
    setTaskPage(1);
    setSearch(value);
  };

  const setTaskPriority = (value: TaskPriority | "ALL") => {
    setTaskPage(1);
    setPriority(value);
  };

  const setTaskSort = (value: typeof sort) => {
    setTaskPage(1);
    setSort(value);
  };

  const setTaskStatus = (value: typeof statusFilter) => {
    setTaskPage(1);
    setStatusFilter(value);
  };

  const clearTaskFilters = () => {
    setTaskStatus("ACTIVE");
    setTaskPriority("ALL");
    selectProject(null);
    setTaskSort("dueDate");
  };

  const toggleTask = async (task: Task) => {
    try {
      await mutations.update.mutateAsync({
        id: task.id,
        payload: {
          status: task.status === "COMPLETED" ? "PENDING" : "COMPLETED",
        },
      });
    } catch {
      toast.error("Ups, no pudimos actualizar la tarea.");
    }
  };

  const openCreate = () => {
    setCreatedTask(null);
    modalUrl.openCreate();
  };
  const openCreateOnDay = (dateKey: string) => {
    setCreatedTask(null);
    modalUrl.openCreate({ dueDate: `${dateKey}T23:59` });
  };
  const openPreview = (task: Task) => {
    setCreatedTask(null);
    modalUrl.openTask(task.id);
  };
  const openFocus = (task: Task) =>
    modalUrl.openFocus(task.id, task.projectId ?? undefined);
  const closeModal = () => {
    setCreatedTask(null);
    modalUrl.close();
  };

  const selectProject = (projectId: string | null) => {
    setTaskPage(1);
    setSelectedProjectId(projectId);
    if (projectId === null) localStorage.removeItem(TASK_PROJECT_FILTER_KEY);
    else localStorage.setItem(TASK_PROJECT_FILTER_KEY, projectId);
  };

  const toggleSelectionMode = () => {
    if (selection.mode) selection.clear();
    else selection.setMode(true);
  };

  const handleBulkDelete = async () => {
    try {
      await mutations.bulkRemove.mutateAsync(Array.from(selection.selectedIds));
      selection.clear();
      setConfirmBulkDelete(false);
      toast.success("¡Listo, tareas eliminadas!");
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ??
        "Ups, no pudimos eliminar las tareas. Inténtalo de nuevo.";
      toast.error(message);
    }
  };

  const handleBulkMove = async (projectId: string | null) => {
    try {
      await mutations.bulkMove.mutateAsync({
        ids: Array.from(selection.selectedIds),
        projectId,
      });
      selection.clear();
      toast.success("¡Listo, tareas movidas!");
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ??
        "Ups, no pudimos mover las tareas. Inténtalo de nuevo.";
      toast.error(message);
    }
  };

  const postponeToday = async (task: Task) => {
    try {
      await mutations.update.mutateAsync({
        id: task.id,
        payload: { dueDate: `${localDateKey(new Date())}T23:59` },
      });
      toast.success("¡Listo, tarea pospuesta para hoy!");
    } catch {
      toast.error("Ups, no pudimos cambiar la fecha.");
    }
  };

  const taskPagination = query.data ? (
    <TaskPagination
      isFetching={query.isFetching}
      meta={query.data.meta}
      onPageChange={setTaskPage}
    />
  ) : null;

  return (
    <section className="tasks-page">
      {modalUrl.state.taskId && urlTaskQuery.isError && !taskFromUrl && <div className="tasks-group mb-6" role="alert">
        <p>No pudimos abrir esta tarea. Puede que ya no esté disponible.</p>
        <div className="mt-4 flex flex-wrap gap-3"><button className="tasks-button" onClick={() => void urlTaskQuery.refetch()}>Reintentar detalle</button><button className="tasks-button" onClick={closeModal}>Volver a la lista</button></div>
      </div>}
      {!previewOpen && <header className="tasks-header">
        <div className="tasks-heading">
          <div><p className="tasks-eyebrow">TAREAS</p><h1>{view === "backlog" ? "Sin fecha límite" : "Tus próximos pasos"}</h1><p className="tasks-muted">{view === "backlog" ? "Dale espacio a lo que quieres hacer después." : "Una tarea a la vez también es avanzar."}</p></div>
          <button className="tasks-button" data-primary onClick={openCreate}><Plus size={18} />Nueva tarea</button>
        </div>
        {!query.isError && <>
          <div className="tasks-tabs" role="tablist" aria-label="Sección de tareas">
            <button role="tab" aria-selected={view === "list"} onClick={() => setTaskView("list")}>Lista</button>
            <button role="tab" aria-selected={view === "backlog"} onClick={() => setTaskView("backlog")}>Sin fecha límite</button>
          </div>
          <div className="tasks-toolbar">
            <label className="tasks-search"><Search size={18}/><input aria-label="Buscar tareas" type="search" placeholder="Buscar tareas..." value={search} onChange={e => setTaskSearch(e.target.value)}/></label>
            <div className="relative">
              <button className="tasks-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18}/>Filtros{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
              {filtersOpen && !isMobile && <>
                <button aria-label="Cerrar filtros" className="fixed inset-0 z-20 cursor-default" onClick={() => setFiltersOpen(false)}/>
                <DesktopTaskFilters allProjects={allProjects} onClear={clearTaskFilters} onClose={() => setFiltersOpen(false)} onPriorityChange={setTaskPriority} onProjectChange={selectProject} onSortChange={setTaskSort} onStatusChange={setTaskStatus} priority={priority} selectedProjectId={selectedProjectId} sort={sort} statusFilter={statusFilter}/>
              </>}
            </div>
            <button className="tasks-button" aria-label="Seleccionar tareas" aria-pressed={selection.mode} onClick={toggleSelectionMode}><CheckSquare size={18}/>Seleccionar</button>
            <select className="tasks-input tasks-project-filter" aria-label="Filtrar por proyecto" value={selectedProjectId ?? ""} onChange={e => selectProject(e.target.value || null)}>
              <option value="">Todos los proyectos</option>{allProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
        </>}
      </header>}
      {isMobile && (
        <Drawer fixed open={filtersOpen} onOpenChange={setFiltersOpen} repositionInputs>
          <DrawerContent className="flex h-[min(85dvh,42rem)] min-h-0 max-h-[85dvh] overflow-hidden border-outline-variant bg-surface-bright">
          <DrawerHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant px-5 py-4 text-left">
            <div>
              <DrawerTitle className="text-left">Filtrar tareas</DrawerTitle>
              <DrawerDescription>
                Elige cómo quieres ver tus tareas.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <button
                aria-label="Cerrar filtros"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                type="button"
              >
                <X size={19} />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 flex-1 grid gap-4 overflow-y-auto p-5">
            <label className="grid gap-1.5">
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                PROYECTO
              </span>
              <select
                aria-label="Filtrar por proyecto"
                className="field"
                onChange={(event) => selectProject(event.target.value || null)}
                value={selectedProjectId ?? ""}
              >
                <option value="">Todos</option>
                {allProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                ESTADO
              </span>
              <select
                aria-label="Filtrar por estado"
                className="field"
                onChange={(event) =>
                  setTaskStatus(event.target.value as typeof statusFilter)
                }
                value={statusFilter}
              >
                <option value="ACTIVE">Activas</option>
                <option value="COMPLETED">Completadas</option>
                <option value="ALL">Todas</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                PRIORIDAD
              </span>
              <select
                aria-label="Filtrar por prioridad"
                className="field"
                onChange={(event) =>
                  setTaskPriority(event.target.value as TaskPriority | "ALL")
                }
                value={priority}
              >
                <option value="ALL">Todas</option>
                <option value="URGENT">Urgentes</option>
                <option value="HIGH">Altas</option>
                <option value="NORMAL">Normales</option>
                <option value="LOW">Bajas</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                ORDENAR POR
              </span>
              <select
                aria-label="Ordenar tareas"
                className="field"
                onChange={(event) =>
                  setTaskSort(event.target.value as typeof sort)
                }
                value={sort}
              >
                <option value="dueDate">Vencimiento</option>
                <option value="priority">Prioridad</option>
                <option value="createdAt">Más recientes</option>
                <option value="title">Título</option>
              </select>
            </label>
            <div className="flex items-center justify-between gap-2 border-t border-outline-variant pt-4">
              <button
                className="rounded-lg border border-outline-variant px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                onClick={clearTaskFilters}
                type="button"
              >
                Limpiar
              </button>
              <DrawerClose asChild>
                <button
                  className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary hover:bg-surface-container-high hover:text-on-surface"
                  type="button"
                >
                  Aplicar filtros
                </button>
              </DrawerClose>
            </div>
          </div>
          </DrawerContent>
        </Drawer>
      )}
      {selection.mode && (
        <div className="shrink-0 border-b border-outline-variant bg-secondary-container/30">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-container-padding py-2 sm:px-6 lg:px-10">
          <span className="mr-1 font-body-sm text-body-sm font-bold text-on-surface">
            {selection.selectedIds.size}{" "}
            {selection.selectedIds.size === 1
              ? "tarea seleccionada"
              : "tareas seleccionadas"}
          </span>
          <select
            aria-label="Mover selección a proyecto"
            className="field h-8 min-w-0 flex-1 text-xs sm:flex-none"
            disabled={
              selection.selectedIds.size === 0 || mutations.bulkMove.isPending
            }
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              void handleBulkMove(value === "__none__" ? null : value);
            }}
            value=""
          >
            <option value="">Mover a proyecto...</option>
            <option disabled={isBulkMoveNoop(null)} value="__none__">
              Sin proyecto
            </option>
            {allProjects.map((project) => (
              <option
                disabled={isBulkMoveNoop(project.id)}
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>
           <button
            aria-label="Eliminar tareas seleccionadas"
            className="flex h-8 items-center gap-1.5 rounded-md border border-outline-variant px-3 font-body-sm text-body-sm text-error hover:bg-error hover:text-error-foreground disabled:opacity-50"
            disabled={selection.selectedIds.size === 0}
            onClick={() => setConfirmBulkDelete(true)}
            type="button"
          >
            <Trash2 size={14} /> Eliminar
          </button>
          <button
            aria-label="Salir del modo selección"
            className="flex h-8 items-center gap-1.5 rounded-md border border-outline-variant px-3 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            onClick={selection.clear}
            type="button"
          >
            <X size={14} /> Salir
          </button>
          </div>
        </div>
      )}
      {!previewOpen && <main className="tasks-main">
        {query.isLoading ? (
          <div className="mx-auto flex min-h-[24rem] w-full max-w-6xl items-center justify-center p-container-padding font-body-sm text-body-sm text-on-surface-variant sm:px-6 lg:px-10">
            Cargando tus tareas...
          </div>
        ) : query.isError ? (
          <div className="tasks-error" role="alert">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/design-official/otter-at-desk.png" alt="" width={520} height={230}/>
            <h2>No pudimos cargar tus tareas</h2><p className="tasks-muted">Puedes volver a intentarlo. Tu trabajo sigue guardado.</p>
            <button className="tasks-button" data-primary disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Reintentando…" : "Reintentar"}</button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="tasks-results">
                {view === "backlog" ? (
                  <BacklogPanel
                    count={backlogCount}
                    onOpen={openPreview}
                    onStartPomodoro={openFocus}
                    onToggle={(task) => void toggleTask(task)}
                    tasks={tasks}
                    previewedTaskId={previewOpen ? modalUrl.state.taskId : null}
                  />
                ) : (
                  <TaskList
                    onCreateOnDay={openCreateOnDay}
                    onOpen={openPreview}
                    onPostponeToday={(task) => void postponeToday(task)}
                    onStartPomodoro={openFocus}
                    onToggle={(task) => void toggleTask(task)}
                    tasks={tasks}
                    previewedTaskId={previewOpen ? modalUrl.state.taskId : null}
                  />
                )}
            </div>
            <div className="mt-6">
              {taskPagination}
            </div>
          </div>
        )}
      </main>}
      <div className={previewOpen ? "hidden" : "sm:hidden"}>
        <FAB
          ariaLabel="Nueva tarea"
          loading={mutations.create.isPending}
          onClick={openCreate}
        />
      </div>
      {confirmBulkDelete && (
        <ConfirmModal
          confirmLabel="Eliminar"
          danger
          loading={mutations.bulkRemove.isPending}
          message={`Se eliminarán ${selection.selectedIds.size} ${selection.selectedIds.size === 1 ? "tarea" : "tareas"}. Esta acción no se puede deshacer.`}
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={() => void handleBulkDelete()}
          title="¿Eliminar tareas seleccionadas?"
        />
      )}
      {modalUrl.state.create && <TaskCreateDialog
        projects={allProjects}
        initial={{ ...parsePrefill(modalUrl.state.prefill), projectId: parsePrefill(modalUrl.state.prefill)?.projectId ?? taskDefaultProjectId }}
        onClose={closeModal}
        onCreate={createTaskAndOpen}
      />}
      {previewOpen && taskFromUrl && (
        <TaskDetailsPanel
          presentation="page"
          key={taskFromUrl.id}
          onAddSubtask={async (taskId, title) => {
            await mutations.addSubtask.mutateAsync({ taskId, title });
          }}
           onClose={closeModal}
           onDelete={async (taskId) => {
             await mutations.remove.mutateAsync(taskId);
           }}
           onDeleteSubtask={async (taskId, subtaskId) => {
             await mutations.removeSubtask.mutateAsync({ taskId, subtaskId });
           }}
           onStartPomodoro={() => openFocus(taskFromUrl)}
          onToggleSubtask={async (taskId, subtaskId, completed) => {
            await mutations.toggleSubtask.mutateAsync({ taskId, subtaskId, completed });
          }}
          onUpdateDescription={async (taskId, description) => {
            await mutations.update.mutateAsync({ id: taskId, payload: { description: description || null } });
          }}
          onUpdateTask={async (taskId, payload) => {
            await mutations.update.mutateAsync({ id: taskId, payload });
          }}
          onUpdateSubtask={async (taskId, subtaskId, title) => {
            await mutations.updateSubtask.mutateAsync({ taskId, subtaskId, payload: { title } });
          }}
          task={taskFromUrl}
        />
      )}
    </section>
  );
}

function DesktopTaskFilters({
  allProjects,
  selectedProjectId,
  statusFilter,
  priority,
  sort,
  onProjectChange,
  onStatusChange,
  onPriorityChange,
  onSortChange,
  onClear,
  onClose,
}: {
  allProjects: Project[];
  selectedProjectId: string | null;
  statusFilter: "ACTIVE" | "COMPLETED" | "ALL";
  priority: TaskPriority | "ALL";
  sort: "priority" | "dueDate" | "createdAt" | "title";
  onProjectChange: (projectId: string | null) => void;
  onStatusChange: (value: "ACTIVE" | "COMPLETED" | "ALL") => void;
  onPriorityChange: (value: TaskPriority | "ALL") => void;
  onSortChange: (value: "priority" | "dueDate" | "createdAt" | "title") => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const activeCount =
    (statusFilter !== "ACTIVE" ? 1 : 0)
    + (priority !== "ALL" ? 1 : 0)
    + (selectedProjectId ? 1 : 0)
    + (sort !== "dueDate" ? 1 : 0);

  return (
    <div
      aria-label="Filtros de tareas"
      className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(31rem,calc(100vw-2rem))] rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-cadence-3"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-3">
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant">PERSONALIZA TU VISTA</p>
          <h3 className="mt-1 font-headline-xs text-headline-xs font-semibold text-on-surface">Filtrar tareas</h3>
        </div>
        <button
          aria-label="Cerrar filtros"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
      </div>

      <div className="grid gap-4 py-4">
        <FilterGroup label="Proyecto">
          <select
            aria-label="Filtrar por proyecto"
            className="field h-10 w-full"
            onChange={(event) => onProjectChange(event.target.value || null)}
            value={selectedProjectId ?? ""}
          >
            <option value="">Todos los proyectos</option>
            {allProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Estado">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={statusFilter === "ACTIVE"} onClick={() => onStatusChange("ACTIVE")}>Activas</FilterChip>
            <FilterChip active={statusFilter === "COMPLETED"} onClick={() => onStatusChange("COMPLETED")}>Completadas</FilterChip>
            <FilterChip active={statusFilter === "ALL"} onClick={() => onStatusChange("ALL")}>Todas</FilterChip>
          </div>
        </FilterGroup>

        <FilterGroup label="Prioridad">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={priority === "ALL"} onClick={() => onPriorityChange("ALL")}>Todas</FilterChip>
            <FilterChip active={priority === "URGENT"} onClick={() => onPriorityChange("URGENT")}>Urgentes</FilterChip>
            <FilterChip active={priority === "HIGH"} onClick={() => onPriorityChange("HIGH")}>Altas</FilterChip>
            <FilterChip active={priority === "NORMAL"} onClick={() => onPriorityChange("NORMAL")}>Normales</FilterChip>
            <FilterChip active={priority === "LOW"} onClick={() => onPriorityChange("LOW")}>Bajas</FilterChip>
          </div>
        </FilterGroup>

        <FilterGroup label="Ordenar por">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={sort === "dueDate"} onClick={() => onSortChange("dueDate")}>Vencimiento</FilterChip>
            <FilterChip active={sort === "priority"} onClick={() => onSortChange("priority")}>Prioridad</FilterChip>
            <FilterChip active={sort === "createdAt"} onClick={() => onSortChange("createdAt")}>Más recientes</FilterChip>
            <FilterChip active={sort === "title"} onClick={() => onSortChange("title")}>Título</FilterChip>
          </div>
        </FilterGroup>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-outline-variant pt-3">
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          {activeCount === 0 ? "Vista predeterminada" : `${activeCount} ${activeCount === 1 ? "filtro activo" : "filtros activos"}`}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            onClick={onClear}
            type="button"
          >
            Limpiar
          </button>
          <button
            className="rounded-lg bg-primary px-3.5 py-2 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container"
            onClick={onClose}
            type="button"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h4 className="font-label-caps text-label-caps text-on-surface-variant">{label}</h4>
      {children}
    </section>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 font-label-md text-label-md transition-colors ${active ? "border-secondary bg-secondary-container text-on-secondary-container" : "border-outline-variant bg-surface text-on-surface-variant hover:border-secondary hover:bg-surface-container-low hover:text-secondary"}`}
      onClick={onClick}
      type="button"
    >
      {active && <Check aria-hidden="true" size={13} />}
      {children}
    </button>
  );
}

export default function TasksPage() {
  return (
    <TaskSelectionProvider>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center font-body-sm text-body-sm text-on-surface-variant">
            Cargando tus tareas...
          </div>
        }
      >
        <TasksPageContent />
      </Suspense>
    </TaskSelectionProvider>
  );
}
