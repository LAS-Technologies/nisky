import { DateTime } from "luxon";
import type { Prisma } from "../../infra/prisma/generated/prisma/client";
import { prisma } from "../../infra/prisma/client";
import { emitToUser } from "../../config/socket.emit";
import { AppError } from "../../utils/errors/handler";
import { assertTaskAccess, getAccessibleProjectIds } from "../projects/access";
import { blockOccurrenceOn, TIME_BLOCKS_TZ, type TimeBlockExceptionRow } from "../timeblocks/timeblocks.util";
import type { TaskScheduleQueryDto, UpsertTaskScheduleDto } from "./task-schedules.validator";

export const TASK_SCHEDULES_TZ = TIME_BLOCKS_TZ;

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const scheduleTaskInclude = {
  subtasks: { orderBy: { order: "asc" } },
  assignee: { select: { id: true, email: true, name: true, avatarUrl: true } },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

const scheduleInclude = {
  task: { include: scheduleTaskInclude },
  timeBlock: { include: { project: true } },
} satisfies Prisma.TaskScheduleInclude;

type ScheduleRow = Prisma.TaskScheduleGetPayload<{ include: typeof scheduleInclude }>;

function assertCalendarDate(value: string) {
  if (!calendarDatePattern.test(value)) throw new AppError("BAD_REQUEST", "La fecha no es válida");
  const parsed = DateTime.fromISO(value, { zone: TASK_SCHEDULES_TZ });
  if (!parsed.isValid || parsed.toISODate() !== value) throw new AppError("BAD_REQUEST", "La fecha no es válida");
  return parsed;
}

function scheduleDate(value: string) {
  assertCalendarDate(value);
  // Keep date-only values stable when they cross the API/database boundary.
  return DateTime.fromISO(`${value}T12:00:00`, { zone: "UTC" }).toJSDate();
}

function calendarStart(value: string) {
  return assertCalendarDate(value).startOf("day").toUTC().toJSDate();
}

function calendarEnd(value: string) {
  return assertCalendarDate(value).endOf("day").toUTC().toJSDate();
}

function serializeDate(value: Date) {
  return DateTime.fromJSDate(value, { zone: "UTC" }).toFormat("yyyy-MM-dd");
}

function taskProgress<T extends { _count?: { comments: number }; subtasks?: Array<{ completed: boolean }> }>(task: T) {
  const { _count, subtasks, ...rest } = task;
  return {
    ...rest,
    subtaskCount: subtasks?.length ?? 0,
    completedSubtasks: subtasks?.filter((subtask) => subtask.completed).length ?? 0,
    commentCount: _count?.comments ?? 0,
  };
}

function resolvedOccurrence(row: Pick<ScheduleRow, "timeBlock" | "date">, exceptions: TimeBlockExceptionRow[]) {
  if (!row.timeBlock || !row.timeBlock.isActive) return null;
  const occurrence = blockOccurrenceOn(row.timeBlock, row.date, exceptions, TASK_SCHEDULES_TZ);
  if (!occurrence.occurs) return { occurs: false as const };
  return occurrence;
}

function serializeSchedule(row: ScheduleRow, exceptions: TimeBlockExceptionRow[]) {
  return {
    id: row.id,
    userId: row.userId,
    taskId: row.taskId,
    date: serializeDate(row.date),
    timeBlockId: row.timeBlockId,
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    task: taskProgress(row.task),
    timeBlock: row.timeBlock,
    occurrence: resolvedOccurrence(row, exceptions),
  };
}

export class TaskScheduleService {
  private async accessibleTaskWhere(userId: string, query: TaskScheduleQueryDto) {
    const accessible = await getAccessibleProjectIds(userId);
    return {
      archivedAt: null,
      OR: [{ userId }, { projectId: { in: accessible } }],
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status
        ? { status: query.status }
        : { status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] as const } }),
    } satisfies Prisma.TaskWhereInput;
  }

  private async exceptionsForRows(userId: string, rows: ScheduleRow[], from: Date, to: Date) {
    const blockIds = rows.map((row) => row.timeBlockId).filter((id): id is string => Boolean(id));
    if (blockIds.length === 0) return [];
    return prisma.timeBlockException.findMany({
      where: {
        userId,
        blockId: { in: blockIds },
        OR: [
          { date: { gte: from, lte: to } },
          { targetDate: { gte: from, lte: to } },
        ],
      },
    });
  }

  async list(userId: string, query: TaskScheduleQueryDto) {
    const fromDay = assertCalendarDate(query.from);
    const toDay = assertCalendarDate(query.to);
    if (fromDay > toDay) throw new AppError("BAD_REQUEST", "El intervalo de fechas no es válido");
    if (toDay.diff(fromDay, "days").days > 30) throw new AppError("BAD_REQUEST", "El intervalo no puede superar 31 días");

    const from = calendarStart(query.from);
    const to = calendarEnd(query.to);
    const taskWhere = await this.accessibleTaskWhere(userId, query);
    const rows = await prisma.taskSchedule.findMany({
      where: {
        userId,
        date: { gte: scheduleDate(query.from), lte: scheduleDate(query.to) },
        task: taskWhere,
      },
      include: scheduleInclude,
      orderBy: [{ date: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    const exceptions = await this.exceptionsForRows(userId, rows, from, to);
    return rows.map((row) => serializeSchedule(row, exceptions));
  }

  private async validateBlock(userId: string, timeBlockId: string, date: Date) {
    const block = await prisma.timeBlock.findFirst({ where: { id: timeBlockId, userId } });
    if (!block) throw new AppError("NOT_FOUND", "Bloque no encontrado");
    if (!block.isActive) throw new AppError("BAD_REQUEST", "El bloque está inactivo");
    const dateKey = serializeDate(date);
    const exceptions = await prisma.timeBlockException.findMany({
      where: {
        userId,
        blockId: timeBlockId,
        OR: [
          { date: { gte: calendarStart(dateKey), lte: calendarEnd(dateKey) } },
          { targetDate: { gte: calendarStart(dateKey), lte: calendarEnd(dateKey) } },
        ],
      },
    });
    const occurrence = blockOccurrenceOn(block, date, exceptions, TASK_SCHEDULES_TZ);
    if (!occurrence.occurs) throw new AppError("BAD_REQUEST", "El bloque no ocurre en esa fecha");
  }

  async upsert(userId: string, taskId: string, data: UpsertTaskScheduleDto) {
    await assertTaskAccess(userId, taskId);
    const date = scheduleDate(data.date);
    await this.validateBlock(userId, data.timeBlockId, date);

    const existing = await prisma.taskSchedule.findUnique({
      where: { userId_taskId: { userId, taskId } },
      select: { date: true, timeBlockId: true, order: true },
    });
    const sameAssignment = existing
      && serializeDate(existing.date) === data.date
      && existing.timeBlockId === data.timeBlockId;
    const maxOrder = sameAssignment || data.order !== undefined
      ? null
      : (await prisma.taskSchedule.aggregate({ where: { userId, date, timeBlockId: data.timeBlockId }, _max: { order: true } }))._max.order;
    const order = data.order ?? (sameAssignment ? existing.order : (maxOrder ?? -1) + 1);

    const row = await prisma.taskSchedule.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: { userId, taskId, date, timeBlockId: data.timeBlockId, order },
      update: { date, timeBlockId: data.timeBlockId, order },
      include: scheduleInclude,
    });
    const exceptions = row.timeBlockId
      ? await this.exceptionsForRows(userId, [row], calendarStart(data.date), calendarEnd(data.date))
      : [];
    emitToUser(userId, "tasks", { kind: "task", taskId });
    return serializeSchedule(row, exceptions);
  }

  async remove(userId: string, taskId: string) {
    await assertTaskAccess(userId, taskId);
    await prisma.taskSchedule.deleteMany({ where: { userId, taskId } });
    emitToUser(userId, "tasks", { kind: "task", taskId });
    return { success: true };
  }
}

export const taskScheduleService = new TaskScheduleService();
