"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Circle,
  ChevronDown,
  Flag,
  ListChecks,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  Repeat2,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Task, TaskPriority, TaskStatus } from "@/types/entities";
import { Avatar } from "@/components/ui/Avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNestedRoot,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PreviewSheet } from "@/components/ui/PreviewSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CommentThread } from "@/features/comments/CommentThread";
import {
  useAccessibleProjects,
  useProjectMembers,
  useProjectsQuery,
} from "@/features/projects/hooks/useProjects";
import { useTaskQuery } from "@/features/tasks/hooks/useTasks";
import { TaskReminderPanel } from "./TaskReminderPanel";
import { TaskReferences } from "./TaskReferences";
import {
  TaskAssigneeSelect,
  TaskDueDateEditor,
  TaskPrioritySelect,
  TaskStatusSelect,
  datetimeWithDate,
  datetimeWithTime,
  taskBadgeClass,
} from "./TaskFieldControls";
import type { TaskUpdatePayload } from "../api/tasks";
import { cn, isTaskOverdue, localDateKey, toDatetimeLocal } from "@/lib/utils";
import { formatTaskDueDate } from "../lib/task-utils";

function createdAtLabel(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date(value))
    .replaceAll(".", "");
}

function resizeDescriptionInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function resizeTitleInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
}

const POMODORO_SAVE_DEBOUNCE_MS = 400;

function normalizePomodoroEstimate(value: number) {
  return Math.min(100, Math.max(0, Math.trunc(value)));
}

const recurrenceOptions = [
  { value: "NONE", label: "No repetir" },
  { value: "DAILY", label: "Cada día" },
  { value: "WEEKLY", label: "Cada semana" },
  { value: "MONTHLY", label: "Cada mes" },
] as const;

const weekdayOptions = [
  { value: "0", label: "D", fullLabel: "Domingo" },
  { value: "1", label: "L", fullLabel: "Lunes" },
  { value: "2", label: "M", fullLabel: "Martes" },
  { value: "3", label: "X", fullLabel: "Miércoles" },
  { value: "4", label: "J", fullLabel: "Jueves" },
  { value: "5", label: "V", fullLabel: "Viernes" },
  { value: "6", label: "S", fullLabel: "Sábado" },
];

type RecurrenceDraft = NonNullable<TaskUpdatePayload["recurrence"]>;
type TaskDetailsOverrides = {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  recurrence?: RecurrenceDraft;
};
type EditableTaskField = keyof TaskDetailsOverrides;

function PreviewDetail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px] leading-5">
      <dt className="flex min-w-0 items-center gap-2 text-on-surface-variant">
        <Icon
          aria-hidden="true"
          className="shrink-0 text-on-surface-variant"
          size={16}
        />
        <span>{label}</span>
      </dt>
      <dd className="min-w-0 break-words text-right font-medium text-on-surface">
        {children}
      </dd>
    </div>
  );
}

export function TaskDetailsPanel({
  task,
  onClose,
  onAddSubtask,
  onDeleteSubtask,
  onUpdateSubtask,
  onUpdateDescription,
  onUpdateTask,
  onToggleSubtask,
  onStartPomodoro,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onAddSubtask: (taskId: string, title: string) => Promise<void>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onUpdateSubtask: (
    taskId: string,
    subtaskId: string,
    title: string,
  ) => Promise<void>;
  onUpdateDescription: (taskId: string, description: string) => Promise<void>;
  onUpdateTask: (taskId: string, payload: TaskUpdatePayload) => Promise<void>;
  onToggleSubtask: (
    taskId: string,
    subtaskId: string,
    completed: boolean,
  ) => Promise<void>;
  onStartPomodoro?: () => void;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const detailQuery = useTaskQuery(task.id);
  const current = detailQuery.data ?? task;
  const isMobile = useIsMobile(1023);
  const [pendingSubtaskId, setPendingSubtaskId] = useState<string | null>(null);
  const [subtaskOverrides, setSubtaskOverrides] = useState<
    Record<string, boolean>
  >({});
  const [subtaskTitleOverrides, setSubtaskTitleOverrides] = useState<
    Record<string, string>
  >({});
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(current.title);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [taskOverrides, setTaskOverrides] = useState<TaskDetailsOverrides>({});
  const [pendingTaskField, setPendingTaskField] =
    useState<EditableTaskField | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [pomodoroEstimateDraft, setPomodoroEstimateDraft] = useState(
    current.pomodoroEstimate,
  );
  const [activePanel, setActivePanel] = useState<"details" | "comments">(
    "details",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [taskDeleting, setTaskDeleting] = useState(false);
  const savingSubtaskRef = useRef(false);
  const skipEditBlurRef = useRef(false);
  const editingSubtaskRef = useRef<HTMLSpanElement>(null);
  const editingSubtaskOriginalTitleRef = useRef("");
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const titleSavingRef = useRef(false);
  const cancelTitleRef = useRef(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const cancelDescriptionRef = useRef(false);
  const pomodoroDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pomodoroSavingRef = useRef(false);
  const pomodoroLatestValueRef = useRef(current.pomodoroEstimate);
  const pomodoroCommittedValueRef = useRef(current.pomodoroEstimate);
  const pomodoroRevisionRef = useRef(0);
  const pomodoroMountedRef = useRef(true);
  const hasTaskOverride = (field: EditableTaskField) =>
    Object.prototype.hasOwnProperty.call(taskOverrides, field);
  const displayTitle = taskOverrides.title ?? current.title;
  const displayStatus = taskOverrides.status ?? current.status;
  const displayPriority = taskOverrides.priority ?? current.priority;
  const displayDueDate = hasTaskOverride("dueDate")
    ? (taskOverrides.dueDate ?? null)
    : current.dueDate;
  const displayProjectId = hasTaskOverride("projectId")
    ? (taskOverrides.projectId ?? null)
    : current.projectId;
  const displayAssigneeId = hasTaskOverride("assigneeId")
    ? (taskOverrides.assigneeId ?? null)
    : current.assigneeId;
  const projectsQuery = useProjectsQuery();
  const accessibleProjectsQuery = useAccessibleProjects();
  const membersQuery = useProjectMembers(displayProjectId);
  const overdue = isTaskOverdue({
    dueDate: displayDueDate,
    status: displayStatus,
  });
  const currentRecurrence: RecurrenceDraft = current.recurrenceType
    ? {
        repeatType: current.recurrenceType,
        repeatInterval: current.recurrenceInterval,
        repeatDaysOfWeek: current.recurrenceDaysOfWeek,
        repeatDayOfMonth: current.recurrenceDayOfMonth ?? undefined,
        repeatEndsAt: current.recurrenceEndsAt
          ? localDateKey(current.recurrenceEndsAt)
          : undefined,
      }
    : {
        repeatType: undefined,
        repeatInterval: 1,
        repeatDaysOfWeek: [],
        repeatEndsAt: undefined,
      };
  const displayRecurrence = taskOverrides.recurrence ?? currentRecurrence;
  const projects = [
    ...(projectsQuery.data ?? []),
    ...(accessibleProjectsQuery.data ?? []),
  ];
  const projectOptions = Array.from(
    new Map(
      [...projects, ...(current.project ? [current.project] : [])].map(
        (project) => [project.id, project],
      ),
    ).values(),
  );
  const selectedProject =
    projectOptions.find((project) => project.id === displayProjectId) ?? null;
  const members = membersQuery.data ?? [];
  const assigneeOptions = members.map((member) => ({
    avatarUrl: member.user.avatarUrl,
    email: member.user.email,
    id: member.userId,
    label: member.user.name ?? member.user.email,
    name: member.user.name,
  }));
  if (
    current.assignee &&
    !assigneeOptions.some((member) => member.id === current.assignee?.id)
  ) {
    assigneeOptions.push({
      avatarUrl: current.assignee.avatarUrl,
      email: current.assignee.email,
      id: current.assignee.id,
      label: current.assignee.name ?? current.assignee.email,
      name: current.assignee.name,
    });
  }
  const subtasks = current.subtasks ?? [];
  const visibleSubtasks = subtasks
    .filter((subtask) => !deletedSubtaskIds.has(subtask.id))
    .map((subtask) => ({
      ...subtask,
      title: subtaskTitleOverrides[subtask.id] ?? subtask.title,
      completed: subtaskOverrides[subtask.id] ?? subtask.completed,
    }));
  const completedSubtasks = visibleSubtasks.filter(
    (subtask) => subtask.completed,
  ).length;
  const subtaskProgress =
    visibleSubtasks.length > 0
      ? Math.round((completedSubtasks / visibleSubtasks.length) * 100)
      : 0;
  const updateTaskField = async (
    field: EditableTaskField,
    payload: TaskUpdatePayload,
    optimistic: Partial<TaskDetailsOverrides>,
    errorMessage: string,
  ) => {
    if (pendingTaskField) return false;
    const fields = Object.keys(optimistic) as EditableTaskField[];
    setPendingTaskField(field);
    setTaskOverrides((previous) => ({ ...previous, ...optimistic }));
    try {
      await onUpdateTask(current.id, payload);
      setTaskOverrides((previous) => {
        const next = { ...previous };
        for (const key of fields) delete next[key];
        return next;
      });
      return true;
    } catch {
      setTaskOverrides((previous) => {
        const next = { ...previous };
        for (const key of fields) delete next[key];
        return next;
      });
      toast.error(errorMessage);
      return false;
    } finally {
      setPendingTaskField(null);
    }
  };

  const openTitleEditor = () => {
    cancelTitleRef.current = false;
    setTitleDraft(displayTitle);
    setTitleEditing(true);
  };

  const closeTitleEditor = () => {
    cancelTitleRef.current = true;
    setTitleEditing(false);
    setTitleDraft(displayTitle);
  };

  const saveTitle = async () => {
    if (titleSavingRef.current || pendingTaskField) return;
    if (cancelTitleRef.current) {
      cancelTitleRef.current = false;
      return;
    }
    const title = titleDraft.trim();
    if (!title) {
      toast.error("El título no puede estar vacío.");
      return;
    }
    if (title === displayTitle) {
      setTitleEditing(false);
      return;
    }
    titleSavingRef.current = true;
    try {
      const updated = await updateTaskField(
        "title",
        { title },
        { title },
        "No pudimos actualizar el título.",
      );
      if (updated) setTitleEditing(false);
      else setTitleDraft(displayTitle);
    } finally {
      titleSavingRef.current = false;
    }
  };

  const updateDueDate = async (value: string) => {
    const nextDueDate = value || null;
    if (displayRecurrence.repeatType && !nextDueDate) {
      toast.error("Una tarea recurrente necesita fecha de vencimiento.");
      return;
    }
    const updated = await updateTaskField(
      "dueDate",
      { dueDate: nextDueDate },
      { dueDate: nextDueDate },
      "No pudimos actualizar el vencimiento.",
    );
    if (updated) setDueDateOpen(false);
  };

  const flushPomodoroEstimate = async () => {
    if (pomodoroSavingRef.current) return;
    const value = pomodoroLatestValueRef.current;
    const revision = pomodoroRevisionRef.current;
    if (value === pomodoroCommittedValueRef.current) return;

    pomodoroSavingRef.current = true;
    try {
      await onUpdateTask(current.id, { pomodoroEstimate: value });
      pomodoroCommittedValueRef.current = value;
    } catch {
      if (revision === pomodoroRevisionRef.current) {
        pomodoroLatestValueRef.current = pomodoroCommittedValueRef.current;
        if (pomodoroMountedRef.current) {
          setPomodoroEstimateDraft(pomodoroCommittedValueRef.current);
          toast.error("No pudimos actualizar los pomodoros estimados.");
        }
      }
    } finally {
      pomodoroSavingRef.current = false;
      if (revision !== pomodoroRevisionRef.current && !pomodoroDebounceRef.current) {
        pomodoroDebounceRef.current = setTimeout(() => {
          pomodoroDebounceRef.current = null;
          void flushPomodoroEstimate();
        }, POMODORO_SAVE_DEBOUNCE_MS);
      }
    }
  };

  const queuePomodoroEstimate = (estimate: number) => {
    if (pendingTaskField) return;
    const nextEstimate = normalizePomodoroEstimate(estimate);
    setPomodoroEstimateDraft(nextEstimate);
    pomodoroLatestValueRef.current = nextEstimate;
    pomodoroRevisionRef.current += 1;
    if (pomodoroDebounceRef.current) clearTimeout(pomodoroDebounceRef.current);
    pomodoroDebounceRef.current = setTimeout(() => {
      pomodoroDebounceRef.current = null;
      void flushPomodoroEstimate();
    }, POMODORO_SAVE_DEBOUNCE_MS);
  };

  const flushPomodoroEstimateNow = () => {
    if (pomodoroDebounceRef.current) clearTimeout(pomodoroDebounceRef.current);
    pomodoroDebounceRef.current = null;
    void flushPomodoroEstimate();
  };

  const resetPomodoroEstimate = () => {
    if (pomodoroSavingRef.current) return;
    if (pomodoroDebounceRef.current) clearTimeout(pomodoroDebounceRef.current);
    pomodoroDebounceRef.current = null;
    pomodoroLatestValueRef.current = pomodoroCommittedValueRef.current;
    pomodoroRevisionRef.current += 1;
    setPomodoroEstimateDraft(pomodoroCommittedValueRef.current);
  };

  const adjustPomodoroEstimate = (amount: number) => {
    queuePomodoroEstimate(pomodoroLatestValueRef.current + amount);
  };

  const handleClose = () => {
    flushPomodoroEstimateNow();
    onClose();
  };

  const updateRecurrence = (value: string) => {
    const repeatType =
      value === "NONE" ? undefined : (value as RecurrenceDraft["repeatType"]);
    if (repeatType && !displayDueDate) {
      toast.error("Añade un vencimiento antes de activar la recurrencia.");
      return;
    }
    const nextRecurrence: RecurrenceDraft = {
      repeatType,
      repeatInterval: displayRecurrence.repeatInterval ?? 1,
      repeatDaysOfWeek:
        repeatType === "WEEKLY"
          ? displayRecurrence.repeatDaysOfWeek.length > 0
            ? displayRecurrence.repeatDaysOfWeek
            : [1]
          : [],
      repeatDayOfMonth:
        repeatType === "MONTHLY"
          ? displayRecurrence.repeatDayOfMonth
          : undefined,
      repeatEndsAt: repeatType ? displayRecurrence.repeatEndsAt : undefined,
    };
    void updateTaskField(
      "recurrence",
      { recurrence: nextRecurrence },
      { recurrence: nextRecurrence },
      "No pudimos actualizar la recurrencia.",
    );
  };

  const updateRecurrenceDays = (values: string[]) => {
    if (values.length === 0) {
      toast.error("Selecciona al menos un día para la recurrencia semanal.");
      return;
    }
    const nextRecurrence: RecurrenceDraft = {
      ...displayRecurrence,
      repeatType: "WEEKLY",
      repeatInterval: displayRecurrence.repeatInterval ?? 1,
      repeatDaysOfWeek: values.map(Number).sort((a, b) => a - b),
    };
    void updateTaskField(
      "recurrence",
      { recurrence: nextRecurrence },
      { recurrence: nextRecurrence },
      "No pudimos actualizar los días de recurrencia.",
    );
  };

  const selectProject = (projectId: string | null) => {
    setProjectOpen(false);
    const clearAssignee = projectId !== current.projectId;
    void updateTaskField(
      "projectId",
      { projectId, ...(clearAssignee ? { assigneeId: null } : {}) },
      { projectId, ...(clearAssignee ? { assigneeId: null } : {}) },
      "No pudimos actualizar el proyecto.",
    );
  };

  const openDueDateEditor = () => {
    setDueDateDraft(
      displayDueDate
        ? toDatetimeLocal(displayDueDate)
        : `${localDateKey(new Date())}T09:00`,
    );
    setDueDateOpen(true);
  };

  const handleDueDateOpenChange = (open: boolean) => {
    if (open) openDueDateEditor();
    else setDueDateOpen(false);
  };

  const dueDateTrigger = (
    <button
      aria-label="Seleccionar fecha de vencimiento"
      className={cn(
        "max-w-[14rem] truncate rounded-md px-1 py-1 text-right font-medium outline-none hover:bg-surface-container-low hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/20",
        !displayDueDate && "text-on-surface-variant",
        overdue && "font-semibold text-error",
      )}
      disabled={pendingTaskField !== null}
      type="button"
    >
      {displayDueDate ? formatTaskDueDate(displayDueDate) : "Sin fecha límite"}
    </button>
  );

  const dueDateEditor = (
    <TaskDueDateEditor
      dueDateDraft={dueDateDraft}
      fullWidth={isMobile}
      onCancel={() => setDueDateOpen(false)}
      onDateChange={(date) =>
        setDueDateDraft((value) => datetimeWithDate(value, date))
      }
      onRemove={() => {
        void updateDueDate("");
      }}
      onSave={() => {
        void updateDueDate(dueDateDraft);
      }}
      onTimeChange={(time) =>
        setDueDateDraft((value) => datetimeWithTime(value, time))
      }
      pending={pendingTaskField !== null}
    />
  );

  useEffect(() => {
    if (!titleEditing || !titleInputRef.current) return;
    const input = titleInputRef.current;
    resizeTitleInput(input);
    input.focus();
    input.select();
  }, [titleEditing]);

  useEffect(() => {
    if (!descriptionOpen || !descriptionInputRef.current) return;
    const input = descriptionInputRef.current;
    resizeDescriptionInput(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [descriptionOpen]);

  useEffect(() => {
    if (!editingSubtaskId || !editingSubtaskRef.current) return;
    const element = editingSubtaskRef.current;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editingSubtaskId]);

  useEffect(() => {
    pomodoroMountedRef.current = true;
    return () => {
      pomodoroMountedRef.current = false;
      if (
        pomodoroDebounceRef.current &&
        pomodoroLatestValueRef.current === pomodoroCommittedValueRef.current
      ) {
        clearTimeout(pomodoroDebounceRef.current);
      }
    };
  }, []);

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (pendingSubtaskId) return;
    setPendingSubtaskId(subtaskId);
    setSubtaskOverrides((previous) => ({
      ...previous,
      [subtaskId]: completed,
    }));
    try {
      await onToggleSubtask(current.id, subtaskId, completed);
      setSubtaskOverrides((previous) => {
        const next = { ...previous };
        delete next[subtaskId];
        return next;
      });
    } catch {
      setSubtaskOverrides((previous) => {
        const next = { ...previous };
        delete next[subtaskId];
        return next;
      });
      toast.error("No pudimos actualizar la subtarea.");
    } finally {
      setPendingSubtaskId(null);
    }
  };

  const addSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title || isAddingSubtask) return;
    setIsAddingSubtask(true);
    try {
      await onAddSubtask(current.id, title);
      setSubtaskTitle("");
    } catch {
      toast.error("No pudimos añadir la subtarea.");
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    if (pendingSubtaskId) return;
    if (editingSubtaskId === subtaskId) cancelSubtaskEdit();
    setPendingSubtaskId(subtaskId);
    setDeletedSubtaskIds((previous) => new Set(previous).add(subtaskId));
    try {
      await onDeleteSubtask(current.id, subtaskId);
    } catch {
      setDeletedSubtaskIds((previous) => {
        const next = new Set(previous);
        next.delete(subtaskId);
        return next;
      });
      toast.error("No pudimos eliminar la subtarea.");
    } finally {
      setPendingSubtaskId(null);
    }
  };

  const beginSubtaskEdit = (subtaskId: string, title: string) => {
    if (
      pendingSubtaskId ||
      (editingSubtaskId && editingSubtaskId !== subtaskId)
    )
      return;
    editingSubtaskOriginalTitleRef.current = title;
    setEditingSubtaskId(subtaskId);
    setEditingSubtaskTitle(title);
    setSubtaskTitleOverrides((previous) => ({
      ...previous,
      [subtaskId]: title,
    }));
  };

  const cancelSubtaskEdit = () => {
    if (editingSubtaskId) {
      setSubtaskTitleOverrides((previous) => {
        const next = { ...previous };
        delete next[editingSubtaskId];
        return next;
      });
    }
    editingSubtaskOriginalTitleRef.current = "";
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const saveSubtaskTitle = async () => {
    const subtaskId = editingSubtaskId;
    if (!subtaskId || savingSubtaskRef.current) return;
    const title = editingSubtaskTitle.trim();
    const subtask = visibleSubtasks.find((item) => item.id === subtaskId);
    if (!subtask) return;
    if (!title) {
      toast.error("El nombre de la subtarea no puede estar vacío.");
      return;
    }
    if (title === editingSubtaskOriginalTitleRef.current) {
      cancelSubtaskEdit();
      return;
    }

    savingSubtaskRef.current = true;
    setPendingSubtaskId(subtaskId);
    setSubtaskTitleOverrides((previous) => ({
      ...previous,
      [subtaskId]: title,
    }));
    try {
      await onUpdateSubtask(current.id, subtaskId, title);
      cancelSubtaskEdit();
      setSubtaskTitleOverrides((previous) => {
        const next = { ...previous };
        delete next[subtaskId];
        return next;
      });
    } catch {
      setSubtaskTitleOverrides((previous) => {
        const next = { ...previous };
        delete next[subtaskId];
        return next;
      });
      toast.error("No pudimos actualizar el nombre de la subtarea.");
    } finally {
      savingSubtaskRef.current = false;
      setPendingSubtaskId(null);
    }
  };

  const openDescriptionEditor = () => {
    cancelDescriptionRef.current = false;
    setDescriptionDraft(current.description ?? "");
    setDescriptionOpen(true);
  };

  const closeDescriptionEditor = () => {
    cancelDescriptionRef.current = true;
    setDescriptionOpen(false);
    setDescriptionDraft(current.description ?? "");
  };

  const saveDescription = async () => {
    if (descriptionSaving) return;
    if (cancelDescriptionRef.current) {
      cancelDescriptionRef.current = false;
      return;
    }
    const description = descriptionDraft.trim();
    if (description === (current.description ?? "").trim()) {
      closeDescriptionEditor();
      return;
    }
    setDescriptionSaving(true);
    try {
      await onUpdateDescription(current.id, description);
      setDescriptionOpen(false);
      toast.success("Descripción actualizada");
    } catch {
      toast.error("No pudimos actualizar la descripción.");
    } finally {
      setDescriptionSaving(false);
    }
  };

  const deleteTask = async () => {
    if (taskDeleting) return;
    setTaskDeleting(true);
    try {
      await onDelete(current.id);
      setConfirmDelete(false);
      toast.success("Tarea eliminada");
      onClose();
    } catch {
      toast.error("Ups, no pudimos eliminar la tarea. Inténtalo de nuevo.");
    } finally {
      setTaskDeleting(false);
    }
  };

  return (
    <>
      <PreviewSheet
        eyebrow="Tarea"
        eyebrowBadge
        eyebrowIcon={ListChecks}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <button
              aria-label="Eliminar tarea"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 font-label-md text-label-md font-semibold text-error hover:bg-error-container/40 disabled:cursor-wait disabled:opacity-60"
              disabled={taskDeleting}
              onClick={() => setConfirmDelete(true)}
              type="button"
            >
              <Trash2 size={16} /> Eliminar
            </button>
            <div className="ml-auto flex min-w-0 flex-1 gap-2">
              {onStartPomodoro && (
                <button
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant px-3 py-2.5 font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary"
                  onClick={onStartPomodoro}
                  type="button"
                >
                  <Timer className="shrink-0 text-error" size={16} /> Pomodoro
                </button>
              )}
            </div>
          </div>
        }
        headerExtra={
          <div className="border-b border-outline-variant px-5 py-3 lg:px-6">
            <div
              aria-label="Secciones de la tarea"
              className="flex rounded-xl bg-surface-container-low p-1"
              role="tablist"
            >
              <button
                aria-selected={activePanel === "details"}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-label-md text-label-md font-semibold transition-colors",
                  activePanel === "details"
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
                onClick={() => setActivePanel("details")}
                role="tab"
                type="button"
              >
                <ListChecks aria-hidden="true" size={15} /> Detalles
              </button>
              <button
                aria-selected={activePanel === "comments"}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-label-md text-label-md font-semibold transition-colors",
                  activePanel === "comments"
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
                onClick={() => setActivePanel("comments")}
                role="tab"
                type="button"
              >
                <MessageSquare aria-hidden="true" size={15} /> Comentarios
              </button>
            </div>
          </div>
        }
        onClose={handleClose}
        tall
        title={
          titleEditing ? (
            <textarea
              aria-busy={pendingTaskField === "title"}
              aria-label="Título de la tarea"
              autoComplete="off"
              className="block max-h-28 min-h-0 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 text-xl leading-7 text-on-surface outline-none focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-wait disabled:opacity-60"
              data-vaul-no-drag
              disabled={pendingTaskField !== null}
              maxLength={200}
              onBlur={() => {
                window.requestAnimationFrame(() => {
                  if (document.activeElement !== titleInputRef.current) {
                    void saveTitle();
                  }
                });
              }}
              onChange={(event) => {
                setTitleDraft(event.target.value);
                resizeTitleInput(event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveTitle();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeTitleEditor();
                }
              }}
              ref={titleInputRef}
              rows={1}
              value={titleDraft}
              wrap="soft"
            />
          ) : (
            <button
              aria-label="Editar título de la tarea"
              className="group inline-flex max-w-full items-start gap-2 text-left"
              onClick={openTitleEditor}
              type="button"
            >
              <span className="min-w-0 break-words">{displayTitle}</span>
              <Pencil
                aria-hidden="true"
                className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                size={13}
              />
            </button>
          )
        }
      >
        {activePanel === "details" ? (
          <div className="space-y-7">
            <section className="rounded-2xl border border-outline-variant/70 bg-surface-container-low/70 p-4">
              <dl className="space-y-3">
                <PreviewDetail icon={Circle} label="Estado">
                  <TaskStatusSelect
                    disabled={pendingTaskField !== null}
                    onChange={(status) =>
                      void updateTaskField(
                        "status",
                        { status },
                        { status },
                        "No pudimos actualizar el estado.",
                      )
                    }
                    value={displayStatus}
                  />
                </PreviewDetail>
                <PreviewDetail icon={Flag} label="Prioridad">
                  <TaskPrioritySelect
                    disabled={pendingTaskField !== null}
                    onChange={(priority) =>
                      void updateTaskField(
                        "priority",
                        { priority },
                        { priority },
                        "No pudimos actualizar la prioridad.",
                      )
                    }
                    value={displayPriority}
                  />
                </PreviewDetail>
                <PreviewDetail icon={ListChecks} label="Proyecto">
                  <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                    <PopoverTrigger asChild>
                      <button
                        aria-label="Cambiar proyecto"
                        className={cn(
                          taskBadgeClass,
                          "max-w-[13rem] gap-1.5 pr-2 focus-visible:ring-2 focus-visible:ring-primary/20",
                          selectedProject
                            ? "border-transparent"
                            : "border-outline-variant bg-surface-container-low text-on-surface-variant",
                        )}
                        disabled={
                          pendingTaskField !== null ||
                          (projectsQuery.isLoading &&
                            accessibleProjectsQuery.isLoading)
                        }
                        style={
                          selectedProject
                            ? {
                                backgroundColor: `color-mix(in srgb, ${selectedProject.color} 12%, transparent)`,
                                borderColor: selectedProject.color,
                                color: selectedProject.color,
                              }
                            : undefined
                        }
                        type="button"
                      >
                        {selectedProject && (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: selectedProject.color }}
                          />
                        )}
                        <span className="min-w-0 truncate">
                          {selectedProject?.name ?? "Sin proyecto"}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-on-surface-variant"
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-0">
                      <Command>
                        <CommandInput placeholder="Buscar proyecto..." />
                        <CommandList>
                          <CommandEmpty>
                            No encontramos ese proyecto.
                          </CommandEmpty>
                          <CommandGroup heading="Proyectos">
                            <CommandItem
                              onSelect={() => selectProject(null)}
                              value="sin proyecto"
                            >
                              <Check
                                className={cn(
                                  "size-4",
                                  displayProjectId === null
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span>Sin proyecto</span>
                            </CommandItem>
                            {projectOptions.map((project) => (
                              <CommandItem
                                key={project.id}
                                onSelect={() => selectProject(project.id)}
                                value={`${project.name} ${project.id}`}
                              >
                                <Check
                                  className={cn(
                                    "size-4",
                                    displayProjectId === project.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: project.color }}
                                />
                                <span className="min-w-0 truncate">
                                  {project.name}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </PreviewDetail>
                <PreviewDetail icon={CalendarDays} label="Vencimiento">
                  {isMobile ? (
                    <DrawerNestedRoot
                      fixed
                      handleOnly
                      open={dueDateOpen}
                      onOpenChange={handleDueDateOpenChange}
                    >
                      <DrawerTrigger asChild>{dueDateTrigger}</DrawerTrigger>
                      <DrawerContent className="flex h-auto min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-none flex-col rounded-t-2xl border-outline-variant bg-surface-bright p-0 shadow-cadence-3 data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-1rem)]">
                        <DrawerHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-outline-variant px-5 py-4 !text-left">
                          <div className="min-w-0">
                            <DrawerTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">
                              Vencimiento
                            </DrawerTitle>
                            <DrawerDescription className="!text-left">
                              {dueDateDraft
                                ? formatTaskDueDate(dueDateDraft)
                                : "Elige una fecha"}
                            </DrawerDescription>
                          </div>
                          <DrawerClose asChild>
                            <button
                              aria-label="Cerrar selector de vencimiento"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                              type="button"
                            >
                              <X size={19} />
                            </button>
                          </DrawerClose>
                        </DrawerHeader>
                        <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
                          {dueDateEditor}
                        </div>
                      </DrawerContent>
                    </DrawerNestedRoot>
                  ) : (
                    <Popover
                      open={dueDateOpen}
                      onOpenChange={handleDueDateOpenChange}
                    >
                      <PopoverTrigger asChild>{dueDateTrigger}</PopoverTrigger>
                      <PopoverContent
                        align="end"
                        avoidCollisions
                        className="max-h-[calc(100dvh-2rem)] w-auto max-w-[var(--radix-popover-content-available-width)] overflow-y-auto p-0"
                        collisionPadding={{
                          bottom: 16,
                          left: 16,
                          right: 16,
                          top: 16,
                        }}
                        hideWhenDetached
                        side="bottom"
                        sideOffset={8}
                        sticky="always"
                        updatePositionStrategy="always"
                      >
                        <div className="border-b border-outline-variant px-4 py-3">
                          <p className="font-label-caps text-label-caps text-on-surface-variant">
                            Vencimiento
                          </p>
                          <p className="mt-0.5 font-body-sm text-body-sm font-semibold text-on-surface">
                            {dueDateDraft
                              ? formatTaskDueDate(dueDateDraft)
                              : "Elige una fecha"}
                          </p>
                        </div>
                        {dueDateEditor}
                      </PopoverContent>
                    </Popover>
                  )}
                </PreviewDetail>
                <PreviewDetail icon={UserRound} label="Creado por">
                  {current.user ? (
                    <span className="inline-flex min-w-0 max-w-[13rem] items-center gap-1.5 text-left">
                      <Avatar
                        avatarUrl={current.user.avatarUrl}
                        email={current.user.email}
                        name={current.user.name}
                        size="sm"
                      />
                      <span className="min-w-0 truncate">
                        {current.user.name ?? current.user.email}
                      </span>
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">Sin información</span>
                  )}
                </PreviewDetail>
                <PreviewDetail icon={CalendarPlus} label="Creada el">
                  <span>{createdAtLabel(current.createdAt)}</span>
                </PreviewDetail>
              </dl>
              <button
                aria-controls="task-preview-extra-details"
                aria-expanded={detailsOpen}
                className="mt-4 flex w-full items-center justify-between border-t border-outline-variant/70 pt-3 text-left font-label-md text-label-md font-semibold text-on-surface-variant outline-none hover:text-primary focus-visible:text-primary"
                onClick={() => setDetailsOpen((open) => !open)}
                type="button"
              >
                <span>{detailsOpen ? "Ocultar detalles" : "Más detalles"}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform",
                    detailsOpen && "rotate-180",
                  )}
                />
              </button>
              {detailsOpen && (
                <dl className="mt-3 space-y-3" id="task-preview-extra-details">
                  <PreviewDetail icon={UserRound} label="Responsable">
                    <TaskAssigneeSelect
                      disabled={
                        pendingTaskField !== null ||
                        !displayProjectId ||
                        membersQuery.isLoading
                      }
                      onChange={(assigneeId) =>
                        void updateTaskField(
                          "assigneeId",
                          { assigneeId },
                          { assigneeId },
                          "No pudimos actualizar el responsable.",
                        )
                      }
                      options={assigneeOptions}
                      value={displayAssigneeId}
                    />
                  </PreviewDetail>
                  <PreviewDetail icon={Repeat2} label="Recurrencia">
                    <span className="flex flex-col items-end gap-2">
                      <Select
                        disabled={pendingTaskField !== null}
                        onValueChange={updateRecurrence}
                        value={displayRecurrence.repeatType ?? "NONE"}
                      >
                        <SelectTrigger
                          aria-label="Cambiar recurrencia"
                          className="max-w-[13rem] cursor-pointer truncate border-transparent bg-transparent px-1 py-1 font-body-sm text-body-sm font-medium text-on-surface shadow-none hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-60"
                        >
                          <SelectValue placeholder="No repetir" />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {recurrenceOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {displayRecurrence.repeatType === "WEEKLY" && (
                        <ToggleGroup
                          aria-label="Días de recurrencia semanal"
                          className="justify-end"
                          disabled={pendingTaskField !== null}
                          onValueChange={updateRecurrenceDays}
                          type="multiple"
                          value={(displayRecurrence.repeatDaysOfWeek ?? []).map(
                            String,
                          )}
                        >
                          {weekdayOptions.map((day) => (
                            <ToggleGroupItem
                              aria-label={day.fullLabel}
                              key={day.value}
                              value={day.value}
                            >
                              {day.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      )}
                    </span>
                  </PreviewDetail>
                  <PreviewDetail icon={Timer} label="Pomodoros">
                    <span className="inline-flex items-center rounded-md border border-outline-variant/70 bg-surface-container-high px-0.5">
                      <span
                        aria-label={`${current.pomodoroCount} pomodoros completados`}
                        className="px-1.5 font-data-mono text-data-mono text-xs font-semibold text-on-surface-variant"
                      >
                        {current.pomodoroCount}
                      </span>
                      <span aria-hidden="true" className="px-0.5 text-on-surface-variant">
                        /
                      </span>
                      <input
                        aria-label="Pomodoros estimados"
                        className="number-input-no-spinner h-7 w-8 border-0 bg-transparent px-0 text-center font-data-mono text-data-mono text-xs font-semibold text-on-surface outline-none focus:bg-surface-container-low focus:ring-0"
                        disabled={pendingTaskField !== null}
                        max={100}
                        min={0}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          queuePomodoroEstimate(Number.isFinite(value) ? value : 0);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            flushPomodoroEstimateNow();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            resetPomodoroEstimate();
                            event.currentTarget.blur();
                          }
                        }}
                        step={1}
                        type="number"
                        value={pomodoroEstimateDraft}
                      />
                      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-outline-variant" />
                      <button
                        aria-label="Disminuir pomodoros estimados"
                        className="flex h-7 w-7 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:cursor-wait disabled:opacity-50"
                        disabled={pendingTaskField !== null || pomodoroEstimateDraft === 0}
                        onClick={() => adjustPomodoroEstimate(-1)}
                        onPointerDown={(event) => event.preventDefault()}
                        type="button"
                      >
                        <Minus aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label="Aumentar pomodoros estimados"
                        className="flex h-7 w-7 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:cursor-wait disabled:opacity-50"
                        disabled={pendingTaskField !== null || pomodoroEstimateDraft === 100}
                        onClick={() => adjustPomodoroEstimate(1)}
                        onPointerDown={(event) => event.preventDefault()}
                        type="button"
                      >
                        <Plus aria-hidden="true" size={15} />
                      </button>
                    </span>
                  </PreviewDetail>
                </dl>
              )}
            </section>

            <TaskReferences
              initialReferences={current.references}
              taskId={current.id}
            />

            <TaskReminderPanel
              dueDate={displayDueDate}
              recurrence={displayRecurrence}
              taskId={current.id}
              taskTitle={current.title}
            />

            <section className="space-y-2">
              <h3 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                Descripción
              </h3>
              {descriptionOpen ? (
                <textarea
                  aria-busy={descriptionSaving}
                  aria-label="Descripción de la tarea"
                  className="block min-h-7 w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-body-lg text-body-lg leading-7 text-on-surface outline-none placeholder:text-on-surface-variant focus:border-0 focus:outline-none focus:ring-0"
                  maxLength={2000}
                  onBlur={() => void saveDescription()}
                  onChange={(event) => {
                    setDescriptionDraft(event.target.value);
                    resizeDescriptionInput(event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void saveDescription();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeDescriptionEditor();
                    }
                  }}
                  placeholder="Añade una descripción para dar contexto."
                  ref={descriptionInputRef}
                  value={descriptionDraft}
                />
              ) : (
                <button
                  aria-label="Editar descripción de la tarea"
                  className="group flex w-full items-start gap-2 rounded-md text-left font-body-lg text-body-lg leading-7 text-on-surface transition-colors hover:text-primary"
                  onClick={openDescriptionEditor}
                  title="Editar descripción"
                  type="button"
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 whitespace-pre-line",
                      !current.description?.trim() && "text-on-surface-variant",
                    )}
                  >
                    {current.description?.trim() || "Añade una descripción para dar contexto."}
                  </span>
                  <Pencil
                    aria-hidden="true"
                    className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                    size={13}
                  />
                </button>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Subtareas
                </h3>
                <span className="font-data-mono text-data-mono text-[11px] font-semibold text-on-surface-variant">
                  {visibleSubtasks.length > 0
                    ? `${completedSubtasks}/${visibleSubtasks.length}`
                    : "Ninguna"}
                </span>
              </div>
              {visibleSubtasks.length > 0 && (
                <>
                  <div
                    aria-label={`Progreso de subtareas: ${subtaskProgress}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={subtaskProgress}
                    className="h-1.5 overflow-hidden rounded-full bg-surface-container"
                    role="progressbar"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                  <div className="divide-y divide-outline-variant/70 border-y border-outline-variant/70">
                    {visibleSubtasks.map((subtask) => (
                      <div
                        className="flex min-h-10 items-center gap-2 py-1"
                        key={subtask.id}
                      >
                        <button
                          aria-checked={subtask.completed}
                          aria-label={`${subtask.completed ? "Desmarcar" : "Marcar"} subtarea: ${subtask.title}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary-fixed disabled:cursor-wait disabled:opacity-60"
                          disabled={
                            pendingSubtaskId !== null ||
                            editingSubtaskId !== null
                          }
                          onClick={() =>
                            void toggleSubtask(subtask.id, !subtask.completed)
                          }
                          role="checkbox"
                          type="button"
                        >
                          {subtask.completed ? (
                            <CheckCircle2 size={17} />
                          ) : (
                            <Circle className="text-outline" size={17} />
                          )}
                        </button>
                        <span
                          aria-label={
                            editingSubtaskId === subtask.id
                              ? `Editar subtarea: ${subtask.title}`
                              : `Editar nombre de la subtarea: ${subtask.title}`
                          }
                          aria-multiline={
                            editingSubtaskId === subtask.id ? false : undefined
                          }
                          aria-pressed={
                            editingSubtaskId === subtask.id ? true : undefined
                          }
                          className={cn(
                            "min-w-0 flex-1 text-left font-body-sm text-body-sm leading-5 text-on-surface outline-none",
                            subtask.completed &&
                              "text-on-surface-variant line-through",
                            editingSubtaskId === subtask.id
                              ? "cursor-text"
                              : "cursor-text hover:text-primary",
                          )}
                          contentEditable={editingSubtaskId === subtask.id}
                          onBlur={() => {
                            if (skipEditBlurRef.current) {
                              skipEditBlurRef.current = false;
                              return;
                            }
                            void saveSubtaskTitle();
                          }}
                          onClick={() =>
                            beginSubtaskEdit(subtask.id, subtask.title)
                          }
                          onInput={(event) => {
                            if (editingSubtaskId !== subtask.id) return;
                            const title = (
                              event.currentTarget.textContent ?? ""
                            ).replaceAll("\u00a0", " ");
                            setEditingSubtaskTitle(title);
                            setSubtaskTitleOverrides((previous) => ({
                              ...previous,
                              [subtask.id]: title,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (editingSubtaskId !== subtask.id) {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                beginSubtaskEdit(subtask.id, subtask.title);
                              }
                              return;
                            }
                            if (event.key === "Enter") {
                              event.preventDefault();
                              skipEditBlurRef.current = true;
                              void saveSubtaskTitle();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              skipEditBlurRef.current = true;
                              cancelSubtaskEdit();
                            }
                          }}
                          ref={
                            editingSubtaskId === subtask.id
                              ? editingSubtaskRef
                              : undefined
                          }
                          role={
                            editingSubtaskId === subtask.id
                              ? "textbox"
                              : "button"
                          }
                          spellCheck={false}
                          tabIndex={pendingSubtaskId !== null ? -1 : 0}
                          suppressContentEditableWarning
                        >
                          {subtask.title}
                        </span>
                        <button
                          aria-label={`Eliminar subtarea: ${subtask.title}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-error-container hover:text-error disabled:cursor-wait disabled:opacity-50"
                          disabled={
                            pendingSubtaskId !== null ||
                            (editingSubtaskId !== null &&
                              editingSubtaskId !== subtask.id)
                          }
                          onClick={() => void deleteSubtask(subtask.id)}
                          onMouseDown={(event) => event.preventDefault()}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <form
                className="flex items-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-2 py-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addSubtask();
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-container text-primary"
                >
                  <Plus size={14} />
                </span>
                <input
                  aria-label="Nueva subtarea"
                  className="h-8 min-w-0 flex-1 bg-transparent px-1 font-body-sm text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                  disabled={isAddingSubtask}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  placeholder="Añadir subtarea..."
                  value={subtaskTitle}
                />
                <button
                  aria-label="Añadir subtarea"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!subtaskTitle.trim() || isAddingSubtask}
                  type="submit"
                >
                  <Check size={15} />
                </button>
              </form>
            </section>
          </div>
        ) : (
          <div className="flex h-[min(60dvh,32rem)] min-h-[24rem] flex-col rounded-2xl border border-outline-variant/70 bg-surface-container-low/40 p-4">
            <div className="flex items-start gap-3 border-b border-outline-variant/70 pb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-secondary">
                <MessageSquare aria-hidden="true" size={17} />
              </span>
              <div className="min-w-0">
                <h2 className="font-label-md text-label-md font-semibold text-on-surface">
                  Comentarios
                </h2>
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                  Añade contexto o deja una nota sobre esta tarea.
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 pt-4">
              <CommentThread
                kind="task"
                id={current.id}
                projectId={displayProjectId}
              />
            </div>
          </div>
        )}
      </PreviewSheet>
      {confirmDelete && (
        <ConfirmModal
          confirmLabel="Eliminar"
          danger
          loading={taskDeleting}
          message={
            <>
              Se eliminará <strong>{current.title}</strong> de forma permanente.
              Esta acción no se puede deshacer.
            </>
          }
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => void deleteTask()}
          title="¿Eliminar tarea?"
        />
      )}
    </>
  );
}
