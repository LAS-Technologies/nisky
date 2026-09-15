import { DateTime } from "luxon";
import { prisma } from "../infra/prisma/client";
import { pushService } from "../modules/push/push.service";
import { defaultNotificationSettings } from "../utils/notifications/notification-settings";
import { hasSkippedLogToday, recordNotificationLog } from "../modules/push/notification-log.service";
import { getProjectAudience } from "../modules/projects/access";
import { emitToUsers } from "../config/socket.emit";
import { scheduleInTimezone } from "../utils/cron-timezone";
import { blockOccurrenceOn, nowMinutes } from "../modules/timeblocks/timeblocks.util";

const TZ = "America/Santo_Domingo";

function nowInTz() {
  return DateTime.now().setZone(TZ);
}

function startOfToday() {
  return nowInTz().startOf("day");
}

function startOfTomorrow() {
  return startOfToday().plus({ days: 1 });
}

function startOfYesterday() {
  return startOfToday().minus({ days: 1 });
}

function toUtc(value: DateTime) {
  return value.toUTC().toJSDate();
}

function wasWarnedToday(value: Date | null) {
  if (!value) return false;
  return DateTime.fromJSDate(value).setZone(TZ).hasSame(nowInTz(), "day");
}

export interface TaskDueNoticeResult {
  tasksNotified: number;
  usersDigested: number;
}

const DUE_BATCH = 200;

export async function processTaskDueNotices(): Promise<TaskDueNoticeResult> {
  const today = startOfToday();
  const tomorrow = startOfTomorrow();

  const candidates = await prisma.task.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      archivedAt: null,
      OR: [{ lastDueWarnedAt: null }, { lastDueWarnedAt: { lt: toUtc(today) } }],
      dueDate: { gte: toUtc(today), lt: toUtc(tomorrow.plus({ days: 1 })) },
    },
    include: { project: true },
    orderBy: { dueDate: "asc" },
    take: DUE_BATCH,
  });

  let tasksNotified = 0;

  const userIds = [...new Set(candidates.map((task) => task.userId))];
  const settingsByUser = new Map<string, { taskDueReminders: boolean }>();
  for (const id of userIds) {
    settingsByUser.set(id, await defaultNotificationSettings(id));
  }

  for (const task of candidates) {
    if (!task.dueDate) continue;
    const due = DateTime.fromJSDate(task.dueDate).setZone(TZ);
    const isToday = due.hasSame(today, "day");
    const isTomorrow = due.hasSame(tomorrow, "day");
    const skipEvent = isToday ? "task_due_today" : isTomorrow ? "task_due_tomorrow" : null;
    if (!skipEvent) continue;
    if (!settingsByUser.get(task.userId)?.taskDueReminders) {
      if (!(await hasSkippedLogToday(task.userId, skipEvent, task.title, startOfToday().toJSDate()))) {
        await recordNotificationLog({
          userId: task.userId,
          event: skipEvent,
          title: task.title,
          status: "skipped",
          error: "Ajustes: recordatorios de tareas desactivados",
        });
      }
      continue;
    }
    if (wasWarnedToday(task.lastDueWarnedAt)) continue;
    const label = task.project?.name ?? "proyecto";

    let title: string;
    let body: string;
    if (isToday) {
      title = `📝 ${task.title}`;
      const isEndOfDay = due.hour === 23 && due.minute === 59;
      body = isEndOfDay ? `Vence hoy · ${label}` : `Vence hoy a las ${due.toFormat("HH:mm")} · ${label}`;
    } else {
      title = `📝 ${task.title}`;
      body = `Vence mañana · ${label}`;
    }
    const type = skipEvent;

    try {
      const result = await pushService.sendToUser(task.userId, {
        title,
        body,
        url: `/tasks?taskId=${encodeURIComponent(task.id)}`,
        tag: `task-due-${type}-${task.id}`,
        data: { taskId: task.id, type, dueDate: task.dueDate.toISOString() },
      });
      if (result.total === 0 || result.sent === 0) continue;
      await prisma.task.update({ where: { id: task.id }, data: { lastDueWarnedAt: new Date() } });
      const audience = [task.userId];
      if (task.projectId) {
        audience.push(...(await getProjectAudience(task.projectId)));
      }
      emitToUsers([...new Set(audience)], "tasks");
      tasksNotified += 1;
    } catch (error) {
      console.error(`[tasks] No se pudo notificar vencimiento de ${task.id}`, error);
    }
  }

  return { tasksNotified, usersDigested: 0 };
}

async function sendMorningDigest() {
  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  const yesterday = startOfYesterday();

  const users = await prisma.pushSubscription.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

  let digested = 0;

  for (const { userId } of users) {
    try {
      const settings = await defaultNotificationSettings(userId);
      if (!settings.morningDigest) continue;
      const [dueToday, overdue, blocks] = await Promise.all([
        prisma.task.count({
          where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] }, archivedAt: null, dueDate: { gte: toUtc(today), lt: toUtc(tomorrow) } },
        }),
        prisma.task.count({
          where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] }, archivedAt: null, dueDate: { lt: toUtc(today), gt: toUtc(yesterday) } },
        }),
        prisma.timeBlock.findMany({
          where: { userId, isActive: true },
          include: {
            project: true,
            exceptions: {
              where: {
                OR: [
                  { date: { gte: toUtc(today), lt: toUtc(tomorrow) } },
                  { targetDate: { gte: toUtc(today), lt: toUtc(tomorrow) } },
                ],
              },
            },
          },
        }),
      ]);

      const nowMin = nowMinutes(new Date(), TZ);
      const upcoming = blocks
        .map((block) => ({ block, occ: blockOccurrenceOn(block, today.toJSDate(), block.exceptions) }))
        .filter((entry): entry is { block: (typeof blocks)[number]; occ: { occurs: true; startMin: number; endMin: number; exceptionId: string | null } } => entry.occ.occurs && entry.occ.startMin >= nowMin)
        .sort((a, b) => a.occ.startMin - b.occ.startMin);
      const firstBlock = upcoming[0];

      const parts: string[] = [];
      if (dueToday > 0) parts.push(`${dueToday === 1 ? "1 tarea vence" : `${dueToday} tareas vencen`} hoy`);
      if (overdue > 0) parts.push(`${overdue} ${overdue === 1 ? "venció" : "vencieron"} ayer`);
      if (firstBlock) {
        const firstBlockLabel = firstBlock.block.project?.name ?? firstBlock.block.name;
        if (firstBlockLabel) {
          parts.push(`«${firstBlockLabel}» te espera a las ${String(Math.floor(firstBlock.occ.startMin / 60)).padStart(2, "0")}:${String(firstBlock.occ.startMin % 60).padStart(2, "0")}`);
        }
      }
      if (parts.length === 0) continue;
      const body = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]!}` : parts[0]!;

      const result = await pushService.sendToUser(userId, {
        title: "☀️ Buenos días",
        body,
        url: "/tasks",
        tag: `digest-${today.toISODate()}`,
        data: { type: "morning_digest" },
      });
      if (result.sent > 0) digested += 1;
    } catch (error) {
      console.error(`[tasks] No se pudo enviar digest a ${userId}`, error);
    }
  }

  return digested;
}

export function startTaskNoticeWorker() {
  void processTaskDueNotices();
  return scheduleInTimezone("*/30 * * * *", () => void processTaskDueNotices());
}

export function startMorningDigestWorker() {
  return scheduleInTimezone("0 7 * * *", () => void sendMorningDigest());
}
