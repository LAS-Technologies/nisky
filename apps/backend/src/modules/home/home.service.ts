import type { Prisma } from "../../infra/prisma/generated/prisma/client";
import { DateTime } from "luxon";
import { prisma } from "../../infra/prisma/client";
import { computeStreak, dateKey } from "../habits/habit-stats";
import { timeBlockService } from "../timeblocks/timeblocks.service";
import { blockOccurrenceOn } from "../timeblocks/timeblocks.util";
import type { TimeBlockExceptionRow } from "../timeblocks/timeblocks.util";
import { eventOccurrenceOn } from "../events/events.util";
import { taskScheduleService } from "../task-schedules/task-schedules.service";

const TZ = "America/Santo_Domingo";

const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

function nowInTz() {
  return DateTime.now().setZone(TZ);
}

function toDowIndex(value: DateTime) {
  return value.weekday % 7; // 0=domingo ... 6=sábado
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function dayKey(value: Date) {
  return DateTime.fromJSDate(value).setZone(TZ).toISODate()!;
}

type BlockCandidate = {
  id: string;
  startMin: number;
  endMin: number;
  daysOfWeek: number[];
  repeatEveryWeeks: number;
  repeatEndsAt: Date | null;
  recurrenceStartsAt: Date | null;
  createdAt: Date;
};

type TimeBlockWithProject = BlockCandidate & { project?: unknown };

type CalendarEventWithExceptions = Prisma.CalendarEventGetPayload<{ include: { exceptions: true } }>;

type NextActivity =
  | { kind: "TIME_BLOCK"; block: TimeBlockWithProject; start: string; end: string }
  | {
      kind: "EVENT";
      event: CalendarEventWithExceptions;
      start: string;
      end: string | null;
      startMin: number | null;
      endMin: number | null;
    };

function nextBlockOccurrence(blocks: TimeBlockWithProject[], exceptions: TimeBlockExceptionRow[], now: DateTime) {
  let best: BlockCandidate | null = null;
  let bestDay: DateTime | null = null;
  for (let offset = 0; offset < 30; offset += 1) {
    const day = now.plus({ days: offset }).startOf("day");
    for (const block of blocks) {
      const occ = blockOccurrenceOn(block, day.toJSDate(), exceptions, TZ);
      if (!occ.occurs) continue;
      if (offset === 0 && occ.startMin <= now.hour * 60 + now.minute) continue;
      if (!best || day < bestDay! || (day.equals(bestDay!) && occ.startMin < best.startMin)) {
        best = { ...block, startMin: occ.startMin, endMin: occ.endMin };
        bestDay = day;
      }
    }
    if (best && offset === 0) break;
  }
  if (!best || !bestDay) return null;
  return {
    block: best,
    start: bestDay.set({ hour: Math.floor(best.startMin / 60), minute: best.startMin % 60 }).toUTC().toISO()!,
    end: bestDay.set({ hour: Math.floor(best.endMin / 60), minute: best.endMin % 60 }).toUTC().toISO()!,
  };
}

function nextEventOccurrence(events: CalendarEventWithExceptions[], now: DateTime) {
  let best: CalendarEventWithExceptions | null = null;
  let bestDay: DateTime | null = null;
  let bestStartMin = 0;
  let bestEndMin: number | null = null;
  let bestTimestamp = Number.POSITIVE_INFINITY;
  const nowMin = now.hour * 60 + now.minute;

  for (let offset = 0; offset < 30; offset += 1) {
    const day = now.plus({ days: offset }).startOf("day");
    for (const event of events) {
      const occurrence = eventOccurrenceOn(event, day.toJSDate(), event.exceptions);
      if (!occurrence.occurs) continue;

      const startMin = event.allDay ? 0 : occurrence.startMin ?? event.startMin;
      if (startMin == null || (offset === 0 && startMin <= nowMin)) continue;
      const timestamp = day.toMillis() + startMin * 60_000;
      if (timestamp >= bestTimestamp) continue;

      best = event;
      bestDay = day;
      bestStartMin = startMin;
      bestEndMin = event.allDay ? null : occurrence.endMin ?? event.endMin;
      bestTimestamp = timestamp;
    }
  }

  if (!best || !bestDay) return null;
  const start = bestDay.set({ hour: Math.floor(bestStartMin / 60), minute: bestStartMin % 60 }).toUTC().toISO()!;
  const end = bestEndMin == null
    ? null
    : bestDay.set({ hour: Math.floor(bestEndMin / 60), minute: bestEndMin % 60 }).toUTC().toISO();
  return { event: best, start, end, startMin: bestStartMin, endMin: bestEndMin };
}

function nextActivityOccurrence(
  blocks: TimeBlockWithProject[],
  events: CalendarEventWithExceptions[],
  exceptions: TimeBlockExceptionRow[],
  now: DateTime,
): NextActivity | null {
  const block = nextBlockOccurrence(blocks, exceptions, now);
  const event = nextEventOccurrence(events, now);
  if (!block && !event) return null;
  if (!event || (block && block.start <= event.start)) {
    return { kind: "TIME_BLOCK", block: block!.block, start: block!.start, end: block!.end };
  }
  return { kind: "EVENT", event: event.event, start: event.start, end: event.end, startMin: event.startMin, endMin: event.endMin };
}

export class HomeService {
  async overview(userId: string) {
    const now = nowInTz();
    const currentMin = now.hour * 60 + now.minute;
    const todayStart = now.startOf("day");
    const tomorrow = todayStart.plus({ days: 1 });
    const dayAfter = tomorrow.plus({ days: 1 });
    const weekStart = todayStart.startOf("week");
    const weekEnd = weekStart.endOf("week");
    const toUtc = (value: DateTime) => value.toUTC().toJSDate();

    const [activeBlock, defaultProject, allBlocks, exceptions, calendarEvents] = await Promise.all([
      timeBlockService.activeNow(userId),
      prisma.project.findFirst({ where: { userId, isDefault: true } }),
      prisma.timeBlock.findMany({
        where: { userId, isActive: true },
        orderBy: [{ startMin: "asc" }, { createdAt: "asc" }],
        include: { project: true },
      }),
      prisma.timeBlockException.findMany({
        where: {
          userId,
          OR: [{ date: { gte: todayStart.toJSDate() } }, { targetDate: { gte: todayStart.toJSDate() } }],
        },
      }),
      prisma.calendarEvent.findMany({ where: { userId }, include: { exceptions: true } }),
    ]);

    const todaySchedules = await taskScheduleService.list(userId, {
      from: todayStart.toISODate()!,
      to: todayStart.toISODate()!,
    });
    const activeBlockTasks = todaySchedules
      .filter((schedule) => schedule.timeBlockId === activeBlock?.id && schedule.occurrence?.occurs !== false)
      .map((schedule) => schedule.task);
    const todayBlockTasks = todaySchedules
      .map((schedule) => ({
        ...schedule.task,
        scheduleState: schedule.occurrence?.occurs === false ? "REPLAN" as const : "ASSIGNED" as const,
      }));

    const occurrence = nextBlockOccurrence(allBlocks, exceptions as TimeBlockExceptionRow[], now);
    const nextBlock = occurrence
      ? {
          ...(allBlocks.find((block) => block.id === occurrence.block.id) ?? occurrence.block),
          startMin: occurrence.block.startMin,
          endMin: occurrence.block.endMin,
        }
      : null;
    const nextBlockStart = occurrence?.start ?? null;
    const nextActivity = nextActivityOccurrence(allBlocks, calendarEvents, exceptions as TimeBlockExceptionRow[], now);

    const activeEvent = calendarEvents
          .map((event) => {
            const occ = eventOccurrenceOn(event, now.toJSDate(), event.exceptions);
            if (!occ.occurs) return null;
            if (event.allDay) return { ...event, startMin: null, endMin: null };
            if (occ.startMin == null || occ.endMin == null) return null;
            if (occ.startMin > currentMin || occ.endMin <= currentMin) return null;
            return { ...event, startMin: occ.startMin, endMin: occ.endMin };
          })
          .find((event): event is NonNullable<typeof event> => event !== null) ?? null;

    const urgentTasks = await prisma.task.findMany({
      where: {
        userId,
        status: "PENDING",
        archivedAt: null,
        schedules: {
          none: {
            userId,
            date: { gte: toUtc(todayStart), lt: toUtc(tomorrow) },
          },
        },
        OR: [
          { dueDate: { lt: toUtc(todayStart) } },
          { dueDate: { gte: toUtc(todayStart), lt: toUtc(tomorrow) } },
          { dueDate: null, priority: "HIGH" },
        ],
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 50,
      include: taskInclude,
    });

    const futureTasks = await prisma.task.findMany({
      where: {
        userId,
        status: "PENDING",
        archivedAt: null,
        dueDate: { gte: toUtc(tomorrow), lt: toUtc(dayAfter.plus({ days: 1 })) },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 20,
      include: taskInclude,
    });

    const futureBlocks = allBlocks.flatMap((block) => {
      const occurrences: Array<TimeBlockWithProject & { date: string }> = [];
      for (const day of [tomorrow, dayAfter]) {
        const occ = blockOccurrenceOn(block, day.toJSDate(), exceptions as TimeBlockExceptionRow[], TZ);
        if (!occ.occurs) continue;
        occurrences.push({
          ...block,
          date: day.toISODate()!,
          startMin: occ.startMin,
          endMin: occ.endMin,
        });
      }
      return occurrences;
    });

    const [workSessions, completedTasks, dueTasks] = await Promise.all([
      prisma.pomodoroSession.findMany({
        where: {
          userId,
          status: "COMPLETED",
          phase: "WORK",
          endedAt: { gte: toUtc(weekStart), lte: toUtc(weekEnd) },
        },
        select: { actualSec: true, plannedSec: true, task: { select: { projectId: true } } },
      }),
      prisma.task.count({
        where: {
          userId,
          status: "COMPLETED",
          archivedAt: null,
          dueDate: { gte: toUtc(weekStart), lte: toUtc(weekEnd) },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          archivedAt: null,
          dueDate: { gte: toUtc(weekStart), lte: toUtc(weekEnd) },
          status: { in: ["PENDING", "COMPLETED"] },
        },
      }),
    ]);

    const projectTargets = await prisma.project.findMany({
      where: { userId, weeklyTargetMinutes: { gt: 0 } },
      select: { id: true, name: true, color: true, weeklyTargetMinutes: true },
    });

    const projectProgress = projectTargets.map((p) => {
      const pSessions = workSessions.filter((s) => s.task?.projectId === p.id);
      const spentSec = pSessions.reduce((sum, s) => sum + (s.actualSec ?? s.plannedSec), 0);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        targetMinutes: p.weeklyTargetMinutes!,
        spentMinutes: Math.floor(spentSec / 60),
      };
    });

    return {
      activeBlock,
      activeEvent,
      blockTasks: activeBlockTasks.slice(0, 20),
      todayTasks: todayBlockTasks.slice(0, 50),
      urgentTasks,
      futureTasks,
      futureBlocks,
      nextBlock,
      nextBlockStart,
      nextActivity,
      weekly: {
        totalWorkSec: workSessions.reduce((sum, session) => sum + (session.actualSec ?? session.plannedSec), 0),
        completedWorkSessions: workSessions.length,
        completedTasks,
        dueTasks,
        projectProgress,
        weekStart: weekStart.toISO()!,
        weekEnd: weekEnd.toISO()!,
      },
    };
  }

  async activity(userId: string, weeks = 12) {
    const end = nowInTz().endOf("day");
    const start = end.minus({ weeks }).startOf("day");
    const toUtc = (value: DateTime) => value.toUTC().toJSDate();

    const [tasksDone, habitEntries, pomWork] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: "COMPLETED", completedAt: { gte: toUtc(start), lte: toUtc(end) } },
        select: { completedAt: true },
      }),
      prisma.habitEntry.findMany({
        where: { userId, completed: true, date: { gte: toUtc(start), lte: toUtc(end) } },
        select: { date: true },
      }),
      prisma.pomodoroSession.findMany({
        where: { userId, status: "COMPLETED", phase: "WORK", endedAt: { gte: toUtc(start), lte: toUtc(end) } },
        select: { endedAt: true },
      }),
    ]);

    const tasks = new Map<string, number>();
    const habits = new Map<string, number>();
    const pomodoro = new Map<string, number>();

    for (const task of tasksDone) if (task.completedAt) increment(tasks, dayKey(task.completedAt));
    for (const entry of habitEntries) increment(habits, dayKey(entry.date));
    for (const session of pomWork) if (session.endedAt) increment(pomodoro, dayKey(session.endedAt));

    const dates = new Set([...tasks.keys(), ...habits.keys(), ...pomodoro.keys()]);
    return Array.from(dates).map((date) => ({
      date,
      tasks: tasks.get(date) ?? 0,
      habits: habits.get(date) ?? 0,
      pomodoro: pomodoro.get(date) ?? 0,
    }));
  }

  async habitsMatrix(userId: string) {
    const now = nowInTz();
    const weekStart = now.startOf("week");
    const weekEnd = weekStart.endOf("week");
    const since = now.minus({ days: 366 }).startOf("day");

    const [habits, entries, history] = await Promise.all([
      prisma.habit.findMany({ where: { userId, archived: false }, orderBy: { createdAt: "asc" } }),
      prisma.habitEntry.findMany({
        where: {
          userId,
          date: { gte: weekStart.toUTC().toJSDate(), lte: weekEnd.toUTC().toJSDate() },
        },
        select: { habitId: true, date: true, completed: true },
      }),
      prisma.habitEntry.findMany({
        where: { userId, completed: true, date: { gte: since.toUTC().toJSDate() } },
        select: { habitId: true, date: true },
        orderBy: { date: "desc" },
      }),
    ]);

    const byHabit = new Map<string, Array<{ date: Date }>>();
    for (const entry of history) {
      const list = byHabit.get(entry.habitId) ?? [];
      list.push({ date: entry.date });
      byHabit.set(entry.habitId, list);
    }

    const today = now.toISODate()!;
    const todayDow = toDowIndex(now);
    const habitsWithState = habits.map((habit) => {
      const scheduledDays = habit.daysOfWeek.length === 0 && habit.frequency === "DAILY"
        ? [0, 1, 2, 3, 4, 5, 6]
        : habit.daysOfWeek;
      const todayEntry = entries.find((entry) => entry.habitId === habit.id && dateKey(entry.date) === today);
      return {
        ...habit,
        todayCompleted: Boolean(todayEntry?.completed),
        streak: computeStreak(byHabit.get(habit.id) ?? [], today, scheduledDays),
        isDueToday: scheduledDays.includes(todayDow),
      };
    });

    return { habits: habitsWithState, entries };
  }
}

export const homeService = new HomeService();
