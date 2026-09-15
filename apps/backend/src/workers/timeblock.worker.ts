import { DateTime } from "luxon";
import { prisma } from "../infra/prisma/client";
import { pushService } from "../modules/push/push.service";
import { defaultNotificationSettings } from "../utils/notifications/notification-settings";
import { recordNotificationLog } from "../modules/push/notification-log.service";
import { scheduleInTimezone } from "../utils/cron-timezone";
import { blockOccurrenceOn, nowMinutes, TIME_BLOCKS_TZ } from "../modules/timeblocks/timeblocks.util";

function nowInTz() {
  return DateTime.now().setZone(TIME_BLOCKS_TZ);
}

function formatMin(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function notifiedToday(value: Date | null) {
  if (!value) return false;
  return DateTime.fromJSDate(value).setZone(TIME_BLOCKS_TZ).hasSame(nowInTz(), "day");
}

export async function processTimeBlockNotifications() {
  const nowMin = nowMinutes();
  const todayStart = DateTime.now().setZone(TIME_BLOCKS_TZ).startOf("day").toJSDate();

  const [dayBlocks, exceptions] = await Promise.all([
    prisma.timeBlock.findMany({
      where: {
        isActive: true,
      },
      include: { project: true, user: true },
    }),
    prisma.timeBlockException.findMany({
      where: { OR: [{ date: { gte: todayStart } }, { targetDate: { gte: todayStart } }] },
    }),
  ]);

  const dueBlocks = dayBlocks.flatMap((block) => {
    const occ = blockOccurrenceOn(block, new Date(), exceptions);
    if (!occ.occurs || occ.endMin <= nowMin) return [];
    return [{ ...block, startMin: occ.startMin, endMin: occ.endMin }];
  });

  const userIds = [...new Set(dueBlocks.map((block) => block.userId))];
  const settingsByUser = new Map<string, { timeBlockReminders: boolean }>();
  for (const id of userIds) {
    settingsByUser.set(id, await defaultNotificationSettings(id));
  }

  for (const block of dueBlocks) {
    const label = block.project?.name ?? block.name ?? "Bloque de enfoque";
    if (!settingsByUser.get(block.userId)?.timeBlockReminders) {
      await recordNotificationLog({
        userId: block.userId,
        event: "timeblock_remind",
        title: label,
        status: "skipped",
        error: "Ajustes: recordatorios de horario desactivados",
      });
      continue;
    }

    try {
      const remindBefore = Math.max(0, block.remindBeforeMin);
      const started = nowMin >= block.startMin;
      const shouldRemindBefore = remindBefore > 0 && !started && nowMin >= block.startMin - remindBefore && nowMin < block.startMin;

      if (shouldRemindBefore && !notifiedToday(block.lastRemindNotifiedAt) && !notifiedToday(block.lastStartNotifiedAt)) {
        const result = await pushService.sendToUser(block.userId, {
          title: `⏰ «${label}» en ${block.startMin - nowMin} min`,
          body: `Empieza a las ${formatMin(block.startMin)}`,
          url: `/tasks?projectId=${block.projectId ?? ""}&view=day`,
          tag: `timeblock-remind-${block.id}`,
          data: { type: "timeblock_remind" },
        });
        if (result.sent > 0) {
          await prisma.timeBlock.update({ where: { id: block.id }, data: { lastRemindNotifiedAt: new Date() } });
        }
      }

      if (started && !notifiedToday(block.lastStartNotifiedAt)) {
        const result = await pushService.sendToUser(block.userId, {
          title: `▶️ «${label}» ya empieza`,
          body: `De ${formatMin(block.startMin)} a ${formatMin(block.endMin)}, a por lo que te propusiste`,
          url: `/tasks?projectId=${block.projectId ?? ""}&view=day`,
          tag: `timeblock-start-${block.id}`,
          data: { timeBlockId: block.id, type: "timeblock_start" },
        });
        if (result.sent > 0) {
          await prisma.timeBlock.update({ where: { id: block.id }, data: { lastStartNotifiedAt: new Date() } });
        }
      }

      const minsToEnd = block.endMin - nowMin;
      if (minsToEnd <= 5 && minsToEnd > 0 && !notifiedToday(block.lastEndWarnNotifiedAt)) {
        const result = await pushService.sendToUser(block.userId, {
          title: `⏳ Queda${minsToEnd === 1 ? "" : "n"} ${minsToEnd} min de «${label}»`,
          body: `Cierre a las ${formatMin(block.endMin)} con todo lo hecho`,
          url: `/tasks?projectId=${block.projectId ?? ""}&view=day`,
          tag: `timeblock-endwarn-${block.id}`,
          data: { timeBlockId: block.id, type: "timeblock_endwarn" },
        });
        if (result.sent > 0) {
          await prisma.timeBlock.update({ where: { id: block.id }, data: { lastEndWarnNotifiedAt: new Date() } });
        }
      }
    } catch (error) {
      console.error(`[timeblocks] No se pudo notificar el bloque ${block.id}`, error);
    }
  }
}

export function startTimeBlockWorker() {
  void processTimeBlockNotifications();
  return scheduleInTimezone("* * * * *", () => void processTimeBlockNotifications());
}
