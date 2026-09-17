export type UserRole = "ADMIN" | "USER";

export interface User {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface Subtask {
  id: string;
  taskId: string;
  userId: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskSource = "MANUAL" | "MOODLE" | "CANVAS" | "UASD";

export type IntegrationProvider = "MOODLE" | "CANVAS" | "UASD";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  color: string;
  isDefault: boolean;
  weeklyTargetMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
  _count?: { tasks: number };
}

export type ProjectRole = "OWNER" | "MEMBER";

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: { id: string; email: string; name: string | null; username: string | null; avatarUrl: string | null };
  role: ProjectRole;
  createdAt: string;
}

export interface ProjectSummary {
  project: Project;
  permissions: {
    role: ProjectRole | null;
    canEditProject: boolean;
    canDeleteProject: boolean;
    canManageMembers: boolean;
    canCreateTasks: boolean;
    canEditTasks: boolean;
  };
  members: ProjectMember[];
  totalTasks: number;
  counts: {
    PENDING: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
    completed: number;
    overdue: number;
  };
  progress: number;
  upcomingTasks: Task[];
  taskCountsByMember: Array<{
    userId: string;
    count: number;
    user: ProjectMember["user"];
    role: ProjectRole;
  }>;
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  project: Project;
  invitedBy: { id: string; email: string; name: string | null; username: string | null };
  email: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  invitee?: { id: string; email: string; name: string | null; username: string | null; avatarUrl: string | null } | null;
}

export interface ProjectInvitePreview {
  project: Pick<Project, "id" | "name" | "description" | "color" | "isDefault">;
}

export interface TimeBlock {
  id: string;
  userId: string;
  projectId: string | null;
  date: string | null;
  recurrenceStartsAt: string | null;
  name: string | null;
  daysOfWeek: number[];
  startMin: number;
  endMin: number;
  isActive: boolean;
  repeatEveryWeeks: number;
  repeatEndsAt: string | null;
  remindBeforeMin: number;
  lastRemindNotifiedAt: string | null;
  lastStartNotifiedAt: string | null;
  lastEndWarnNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeBlockWithProject extends TimeBlock {
  project: Project | null;
}

export type TaskScheduleOccurrence =
  | { occurs: true; startMin: number; endMin: number; exceptionId: string | null }
  | { occurs: false }
  | null;

export interface TaskSchedule {
  id: string;
  userId: string;
  taskId: string;
  date: string;
  timeBlockId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  task: Task;
  timeBlock: TimeBlockWithProject;
  occurrence: TaskScheduleOccurrence;
}

export type HomeBlockTask = Task & { scheduleState: "ASSIGNED" | "REPLAN" };

export interface TimeBlockSettings {
  userId: string;
  dayStartMin: number;
  dayEndMin: number;
  updatedAt: string;
}

export type EventRecurrenceType = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  date: string;
  recurrenceStartsAt: string | null;
  baseDate?: string;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  baseStartMin?: number | null;
  baseEndMin?: number | null;
  location: string | null;
  color: string | null;
  recurrenceType: EventRecurrenceType | null;
  recurrenceInterval: number;
  recurrenceDaysOfWeek: number[];
  recurrenceDayOfMonth: number | null;
  recurrenceEndsAt: string | null;
  remindBeforeMin: number;
  lastRemindNotifiedAt: string | null;
  lastStartNotifiedAt: string | null;
  lastEndWarnNotifiedAt: string | null;
  isException?: boolean;
  exceptionAction?: "skip" | "move";
  exceptions?: CalendarEventException[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventException {
  id: string;
  eventId: string;
  userId: string;
  date: string;
  targetDate: string | null;
  action: "skip" | "move";
  startMin: number | null;
  endMin: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeBlockException {
  id: string;
  blockId: string;
  userId: string;
  date: string;
  targetDate: string | null;
  action: "skip" | "move";
  startMin: number | null;
  endMin: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  userId: string;
  morningDigest: boolean;
  taskDueReminders: boolean;
  integrationNews: boolean;
  integrationErrors: boolean;
  timeBlockReminders: boolean;
  updatedAt: string;
}

export interface IntegrationAccount {
  id: string;
  provider: IntegrationProvider;
  domain: string;
  username: string | null;
  service: string | null;
  period?: string | null;
  nextSyncAt?: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UasdSyncJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface UasdSyncJob {
  id: string;
  accountId: string;
  status: UasdSyncJobStatus;
  reason: string;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskRecurrenceType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface TaskReference {
  id: string;
  taskId: string;
  userId: string;
  title: string | null;
  url: string;
  order: number;
  source: TaskSource;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  source: TaskSource;
  sourceRef: string | null;
  projectId: string | null;
  order: number;
  pomodoroEstimate: number;
  pomodoroCount: number;
  references?: TaskReference[];
  user?: { id: string; email: string; name: string | null; username: string | null; avatarUrl: string | null };
  assigneeId: string | null;
  assignee?: { id: string; email: string; name: string | null; avatarUrl: string | null } | null;
  recurrenceType: TaskRecurrenceType | null;
  recurrenceInterval: number;
  recurrenceDaysOfWeek: number[];
  recurrenceDayOfMonth: number | null;
  recurrenceEndsAt: string | null;
  recurrenceParentId: string | null;
  subtaskCount?: number;
  completedSubtasks?: number;
  subtasks?: Subtask[];
  commentCount?: number;
  project?: { id: string; name: string; color: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  currentPage: number;
  itemsPerPage: number;
  itemCount: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export type HabitFrequency = "DAILY" | "WEEKLY";

export interface Habit {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  frequency: HabitFrequency;
  targetDays: number;
  daysOfWeek: number[];
  archived: boolean;
  todayCompleted: boolean;
  streak: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitMatrixHabit extends Habit {
  isDueToday: boolean;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completed: boolean;
  createdAt: string;
}

export type QuickNoteStatus = "INBOX" | "ARCHIVED";

export interface QuickNote {
  id: string;
  userId: string;
  content: string;
  status: QuickNoteStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReminderRepeatType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  triggerAt: string;
  timezone: string;
  repeatType: ReminderRepeatType | null;
  repeatInterval: number;
  repeatDaysOfWeek: number[];
  repeatDayOfMonth: number | null;
  payload: { type?: string; taskId?: string; habitId?: string; timeBlockId?: string } | null;
  isActive: boolean;
  sentAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PomodoroPhase = "WORK" | "SHORT_BREAK" | "LONG_BREAK";
export type PomodoroSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface PomodoroSession {
  id: string;
  userId: string;
  taskId: string | null;
  phase: PomodoroPhase;
  status: PomodoroSessionStatus;
  plannedSec: number;
  actualSec: number | null;
  cycleIndex: number;
  startedAt: string;
  pausedAt: string | null;
  totalPausedSec: number;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  task?: { id: string; title: string } | null;
}

export interface PomodoroSettings {
  workSec: number;
  shortBreakSec: number;
  longBreakSec: number;
  cyclesPerLong: number;
  autoCycle: boolean;
  soundEnabled: boolean;
}

export interface PomodoroStats {
  totalSessions: number;
  completedSessions: number;
  completedWorkSessions: number;
  totalWorkSec: number;
  totalBreakSec: number;
  activeDays: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  classification: string | null;
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDraft {
  title: string;
  classification: string | null;
  tags: string[];
  content: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  pinned: boolean;
  collaboratorsCanEdit: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; name: string | null; username: string | null; avatarUrl: string | null };
  project?: Pick<Project, "id" | "name" | "color"> | null;
}

export interface NoteDraft {
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  pinned: boolean;
  projectId: string | null;
  updatedAt: string;
}

export interface Comment {
  id: string;
  body: string;
  projectId: string | null;
  taskId: string | null;
  author: { id: string; email: string; name: string | null; avatarUrl: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  actorId: string;
  actor: { id: string; email: string; name: string | null; username: string | null; avatarUrl: string | null };
  type: string;
  entityId: string | null;
  entityTitle: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProjectResource {
  id: string;
  projectId: string;
  createdById: string;
  createdBy: { id: string; email: string; name: string | null; username: string | null; avatarUrl: string | null };
  title: string;
  url: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacetCount {
  name: string;
  count: number;
}

export interface KnowledgeFacets {
  categories: FacetCount[];
  tags: FacetCount[];
}

export type FeedbackCategory = "BUG" | "IDEA" | "IMPROVEMENT" | "OTHER";
export type FeedbackStatus = "NEW" | "REVIEWING" | "RESOLVED";

export interface Feedback {
  id: string;
  userId: string;
  category: FeedbackCategory;
  message: string;
  contactEmail: string | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackWithAuthor extends Feedback {
  user: { id: string; email: string; name: string | null };
}

export interface HomeWeeklyStats {
  totalWorkSec: number;
  completedWorkSessions: number;
  completedTasks: number;
  dueTasks: number;
  projectProgress?: Array<{
    id: string;
    name: string;
    color: string;
    targetMinutes: number;
    spentMinutes: number;
  }>;
  weekStart: string;
  weekEnd: string;
}

export type HomeNextActivity =
  | {
      kind: "TIME_BLOCK";
      block: TimeBlockWithProject;
      start: string;
      end: string;
    }
  | {
      kind: "EVENT";
      event: CalendarEvent;
      start: string;
      end: string | null;
      startMin: number | null;
      endMin: number | null;
    };

export interface HomeOverview {
  activeBlock: TimeBlockWithProject | null;
  activeEvent: CalendarEvent | null;
  blockTasks: Task[];
  todayTasks: HomeBlockTask[];
  urgentTasks: Task[];
  futureTasks: (Task & { project: Project | null })[];
  futureBlocks: (TimeBlockWithProject & { date?: string })[];
  nextBlock: TimeBlockWithProject | null;
  nextBlockStart: string | null;
  nextActivity: HomeNextActivity | null;
  weekly: HomeWeeklyStats;
}

export interface HomeActivityPoint {
  date: string;
  tasks: number;
  habits: number;
  pomodoro: number;
}

export interface HabitMatrixEntry {
  habitId: string;
  date: string;
  completed: boolean;
}

export interface HabitsMatrix {
  habits: HabitMatrixHabit[];
  entries: HabitMatrixEntry[];
}
