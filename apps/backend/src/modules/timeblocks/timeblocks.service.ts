import { prisma } from "../../infra/prisma/client";
import { AppError } from "../../utils/errors/handler";
import { calendarDateKey, calendarDateToDate, calendarDayStart, nextCalendarDayStart, todayCalendarStart } from "../../utils/calendar-date";
import { findCalendarConflict, type CalendarConflict, type EventSeries, type TimeBlockSeries } from "../../utils/calendar/recurrence-overlap";
import { blockOccurrenceOn, dayOfWeek, nowMinutes, TIME_BLOCKS_TZ } from "./timeblocks.util";
import { DateTime } from "luxon";
import { eventOccurrenceOn } from "../events/events.util";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";
import type { CreateTimeBlockDto, UpdateTimeBlockDto, UpdateTimeBlockSettingsDto } from "./timeblocks.validator";

const settingsDefaults = {
  dayStartMin: 360,
  dayEndMin: 1380,
};

type TimeBlockRow = TimeBlockSeries["block"] & {
  name?: string | null;
  project?: { name: string } | null;
  exceptions?: Array<{
    id: string;
    blockId: string;
    action: string;
    startMin: number | null;
    endMin: number | null;
    date: Date;
    targetDate: Date | null;
  }>;
};

type CalendarEventRow = CalendarEvent & { exceptions?: CalendarEventException[] };

function timeBlockSeries(block: TimeBlockRow, label?: string): TimeBlockSeries {
  return {
    kind: "TIME_BLOCK",
    id: block.id,
    label: label ?? block.name ?? block.project?.name ?? "bloque sin nombre",
    block,
    exceptions: (block.exceptions ?? []) as TimeBlockSeries["exceptions"],
  };
}

function eventSeries(event: CalendarEventRow): EventSeries {
  return {
    kind: "EVENT",
    id: event.id,
    label: event.title,
    event,
    exceptions: event.exceptions ?? [],
  };
}

function conflictMessage(conflict: CalendarConflict) {
  const prefix = conflict.kind === "TIME_BLOCK" ? "Ya tienes un bloque" : "Ya tienes un evento";
  return `${prefix} que se cruza con «${conflict.label}»`;
}

export class TimeBlockService {
  async getSettings(userId: string) {
    return prisma.timeBlockSettings.upsert({
      where: { userId },
      create: { userId, ...settingsDefaults },
      update: {},
    });
  }

  async updateSettings(userId: string, data: UpdateTimeBlockSettingsDto) {
    return prisma.timeBlockSettings.upsert({
      where: { userId },
      create: { userId, ...settingsDefaults, ...data },
      update: data,
    });
  }

  async list(userId: string) {
    return prisma.timeBlock.findMany({
      where: { userId },
      orderBy: [{ startMin: "asc" }, { createdAt: "asc" }],
    });
  }

  async getById(userId: string, id: string) {
    const block = await prisma.timeBlock.findFirst({ where: { id, userId } });
    if (!block) throw new AppError("NOT_FOUND", "Bloque no encontrado");
    return block;
  }

  async activeNow(userId: string) {
    const now = new Date();
    const todayStart = DateTime.now().setZone(TIME_BLOCKS_TZ).startOf("day").toJSDate();
    const [candidates, exceptions] = await Promise.all([
      prisma.timeBlock.findMany({
        where: { userId, isActive: true },
        include: { project: true },
      }),
      prisma.timeBlockException.findMany({
        where: { userId, OR: [{ date: { gte: todayStart } }, { targetDate: { gte: todayStart } }] },
      }),
    ]);
    const nowMin = nowMinutes(now);
    const matched = candidates.find((block) => {
      const occ = blockOccurrenceOn(block, now, exceptions);
      if (!occ.occurs) return false;
      return occ.startMin <= nowMin && occ.endMin > nowMin;
    });
    if (!matched) return null;
    const occ = blockOccurrenceOn(matched, now, exceptions);
    if (!occ.occurs) return null;
    return { ...matched, startMin: occ.startMin, endMin: occ.endMin };
  }

  async today(userId: string) {
    const now = new Date();
    const todayStart = DateTime.now().setZone(TIME_BLOCKS_TZ).startOf("day").toJSDate();
    const [candidates, exceptions] = await Promise.all([
      prisma.timeBlock.findMany({
        where: { userId },
        include: { project: true },
      }),
      prisma.timeBlockException.findMany({
        where: { userId, OR: [{ date: { gte: todayStart } }, { targetDate: { gte: todayStart } }] },
      }),
    ]);
    return candidates
      .map((block) => {
        const occ = blockOccurrenceOn(block, now, exceptions);
        if (!occ.occurs) return null;
        return { ...block, startMin: occ.startMin, endMin: occ.endMin };
      })
      .filter((block): block is NonNullable<typeof block> => block !== null)
      .sort((a, b) => a.startMin - b.startMin || a.createdAt.getTime() - b.createdAt.getTime());
  }

  private async assertNoOverlap(
    userId: string,
    candidate: TimeBlockSeries,
    excludeId?: string,
  ) {
    const [blocks, events] = await Promise.all([
      prisma.timeBlock.findMany({
        where: { userId, id: excludeId ? { not: excludeId } : undefined },
        include: { project: { select: { name: true } }, exceptions: true },
      }),
      prisma.calendarEvent.findMany({ where: { userId }, include: { exceptions: true } }),
    ]);
    const existing = [
      ...blocks.map((block) => timeBlockSeries(block as TimeBlockRow)),
      ...events.map((event) => eventSeries(event as CalendarEventRow)),
    ];
    const conflict = findCalendarConflict(candidate, existing);
    if (conflict) throw new AppError("CONFLICT", conflictMessage(conflict), conflict);
  }

  async create(userId: string, data: CreateTimeBlockDto) {
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, userId } });
      if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    }
    const now = new Date();
    const blockDate = data.date ? calendarDateToDate(data.date) : null;
    const recurring = blockDate === null;
    const recurrenceStartsAt = recurring ? todayCalendarStart() : null;
    const daysOfWeek = recurring ? data.daysOfWeek : [dayOfWeek(blockDate)];
    const repeatEveryWeeks = recurring ? data.repeatEveryWeeks ?? 1 : 1;
    const repeatEndsAt = recurring && data.repeatEndsAt ? calendarDateToDate(data.repeatEndsAt) : null;
    if (repeatEndsAt && repeatEndsAt < calendarDayStart(recurrenceStartsAt!)) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior al inicio del bloque");
    }
    const candidate = {
      id: "new-time-block",
      date: blockDate,
      recurrenceStartsAt,
      startMin: data.startMin,
      endMin: data.endMin,
      createdAt: now,
      daysOfWeek,
      repeatEveryWeeks,
      repeatEndsAt,
    } satisfies TimeBlockSeries["block"];
    await this.assertNoOverlap(userId, timeBlockSeries(candidate, data.name ?? undefined));
    return prisma.timeBlock.create({
      data: {
        userId,
        projectId: data.projectId ?? null,
        date: blockDate,
        recurrenceStartsAt,
        name: data.name ?? null,
        daysOfWeek,
        startMin: data.startMin,
        endMin: data.endMin,
        repeatEveryWeeks,
        repeatEndsAt,
        remindBeforeMin: data.remindBeforeMin ?? 0,
      },
    });
  }

  private async updateFromDate(userId: string, id: string, data: UpdateTimeBlockDto) {
    const current = await this.getById(userId, id);
    if (current.date) {
      throw new AppError("BAD_REQUEST", "Solo los bloques recurrentes admiten cambios futuros");
    }

    const effectiveDate = DateTime.fromJSDate(calendarDateToDate(data.effectiveFrom!), { zone: TIME_BLOCKS_TZ }).startOf("day");
    const seriesStart = DateTime.fromJSDate(current.recurrenceStartsAt ?? current.createdAt, { zone: TIME_BLOCKS_TZ }).startOf("day");
    if (!effectiveDate.isValid || effectiveDate < seriesStart) {
      throw new AppError("BAD_REQUEST", "La fecha de cambio no es válida para este bloque");
    }
    if (current.repeatEndsAt && effectiveDate > DateTime.fromJSDate(current.repeatEndsAt, { zone: TIME_BLOCKS_TZ }).endOf("day")) {
      throw new AppError("BAD_REQUEST", "La fecha de cambio está después del final del bloque");
    }

    const isOneOff = data.date !== undefined && data.date !== null;
    const nextDate = isOneOff
      ? DateTime.fromJSDate(calendarDateToDate(data.date!), { zone: TIME_BLOCKS_TZ }).startOf("day")
      : null;
    if (nextDate && (!nextDate.isValid || nextDate < effectiveDate)) {
      throw new AppError("BAD_REQUEST", "La nueva fecha debe ser igual o posterior a la fecha de cambio");
    }

    const daysOfWeek = isOneOff && nextDate
      ? [dayOfWeek(nextDate.toJSDate())]
      : data.daysOfWeek ?? current.daysOfWeek;
    const startMin = data.startMin ?? current.startMin;
    const endMin = data.endMin ?? current.endMin;
    const repeatEveryWeeks = data.repeatEveryWeeks ?? current.repeatEveryWeeks;
    const repeatEndsAt = data.repeatEndsAt === undefined
      ? current.repeatEndsAt
      : data.repeatEndsAt
        ? calendarDateToDate(data.repeatEndsAt)
        : null;
    if (repeatEndsAt && repeatEndsAt < effectiveDate.toJSDate()) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior a la fecha de cambio");
    }
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, userId } });
      if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    }

    const candidate = {
      id,
      date: nextDate?.toJSDate() ?? null,
      recurrenceStartsAt: isOneOff ? null : effectiveDate.toJSDate(),
      startMin,
      endMin,
      createdAt: current.createdAt,
      daysOfWeek,
      repeatEveryWeeks: isOneOff ? 1 : repeatEveryWeeks,
      repeatEndsAt: isOneOff ? null : repeatEndsAt,
    } satisfies TimeBlockSeries["block"];
    await this.assertNoOverlap(userId, timeBlockSeries(candidate, data.name ?? current.name ?? undefined), id);

    const splitDate = effectiveDate.minus({ days: 1 }).toJSDate();
    const effectiveDateValue = effectiveDate.toJSDate();
    return prisma.$transaction(async (tx) => {
      await tx.timeBlock.update({
        where: { id },
        data: { repeatEndsAt: splitDate },
      });
      const created = await tx.timeBlock.create({
        data: {
          userId: current.userId,
          projectId: data.projectId !== undefined ? data.projectId : current.projectId,
          date: nextDate?.toJSDate() ?? null,
          recurrenceStartsAt: isOneOff ? null : effectiveDateValue,
          name: data.name !== undefined ? data.name : current.name,
          daysOfWeek,
          startMin,
          endMin,
          isActive: data.isActive ?? current.isActive,
          repeatEveryWeeks: isOneOff ? 1 : repeatEveryWeeks,
          repeatEndsAt: isOneOff ? null : repeatEndsAt,
          remindBeforeMin: data.remindBeforeMin ?? current.remindBeforeMin,
          lastRemindNotifiedAt: null,
          lastStartNotifiedAt: null,
          lastEndWarnNotifiedAt: null,
        },
      });
      const carriedExceptions = await tx.timeBlockException.findMany({
        where: { blockId: id, date: { lt: effectiveDateValue }, targetDate: { gte: effectiveDateValue } },
      });
      await tx.timeBlockException.updateMany({
        where: { blockId: id, date: { gte: effectiveDateValue } },
        data: { blockId: created.id },
      });
      for (const exception of carriedExceptions) {
        await tx.timeBlockException.create({
          data: {
            blockId: created.id,
            userId: exception.userId,
            date: exception.date,
            targetDate: exception.targetDate,
            action: exception.action,
            startMin: exception.startMin,
            endMin: exception.endMin,
          },
        });
      }
      await tx.taskSchedule.updateMany({
        where: { timeBlockId: id, date: { gte: effectiveDateValue } },
        data: { timeBlockId: created.id },
      });
      return created;
    });
  }

  async update(userId: string, id: string, data: UpdateTimeBlockDto) {
    if (data.effectiveFrom !== undefined) return this.updateFromDate(userId, id, data);
    const current = await this.getById(userId, id);
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, userId } });
      if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    }
    const blockDate = data.date !== undefined
      ? (data.date ? calendarDateToDate(data.date) : null)
      : current.date;
    const isRecurring = blockDate === null;
    const daysOfWeek = isRecurring
      ? data.daysOfWeek ?? current.daysOfWeek
      : [dayOfWeek(blockDate)];
    const startMin = data.startMin ?? current.startMin;
    const endMin = data.endMin ?? current.endMin;
    const recurrenceStartsAt = isRecurring
      ? current.date ?? current.recurrenceStartsAt ?? current.createdAt
      : null;
    const repeatEveryWeeks = isRecurring ? data.repeatEveryWeeks ?? current.repeatEveryWeeks : 1;
    const repeatEndsAt = isRecurring
      ? data.repeatEndsAt === undefined
        ? current.repeatEndsAt
        : data.repeatEndsAt
          ? calendarDateToDate(data.repeatEndsAt)
          : null
      : null;
    if (repeatEndsAt && repeatEndsAt < calendarDayStart(recurrenceStartsAt!)) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior al inicio del bloque");
    }
    const candidate = {
      id,
      date: blockDate,
      recurrenceStartsAt,
      startMin,
      endMin,
      createdAt: current.createdAt,
      daysOfWeek,
      repeatEveryWeeks,
      repeatEndsAt,
    } satisfies TimeBlockSeries["block"];
    await this.assertNoOverlap(userId, timeBlockSeries(candidate, data.name ?? current.name ?? undefined), id);
    const timingChanged =
      data.startMin !== undefined ||
      data.endMin !== undefined ||
      data.daysOfWeek !== undefined ||
      data.remindBeforeMin !== undefined;

    if (
      data.startMin !== undefined ||
      data.endMin !== undefined ||
      data.daysOfWeek !== undefined
    ) {
      const today = todayCalendarStart();
      await prisma.timeBlockException.deleteMany({
        where: {
          blockId: id,
          date: { gte: today },
        },
      });
    }

    return prisma.timeBlock.update({
      where: { id },
      data: {
        ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
        ...(data.date !== undefined ? { date: blockDate } : {}),
        ...(data.date !== undefined ? { recurrenceStartsAt } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.daysOfWeek !== undefined || data.date !== undefined ? { daysOfWeek } : {}),
        ...(data.startMin !== undefined ? { startMin: data.startMin } : {}),
        ...(data.endMin !== undefined ? { endMin: data.endMin } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.repeatEveryWeeks !== undefined || data.date !== undefined ? { repeatEveryWeeks } : {}),
        ...(data.repeatEndsAt !== undefined || data.date !== undefined ? { repeatEndsAt } : {}),
        ...(data.remindBeforeMin !== undefined ? { remindBeforeMin: data.remindBeforeMin } : {}),
        ...(timingChanged
          ? { lastRemindNotifiedAt: null, lastStartNotifiedAt: null, lastEndWarnNotifiedAt: null }
          : {}),
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await prisma.timeBlock.delete({ where: { id } });
    return { success: true };
  }

  async createException(userId: string, id: string, data: import("./timeblocks.validator").CreateTimeBlockExceptionDto) {
    const block = await prisma.timeBlock.findFirst({ where: { id, userId }, include: { exceptions: true } });
    if (!block) throw new AppError("NOT_FOUND", "Bloque no encontrado");
    const exceptions = (block.exceptions ?? []) as TimeBlockSeries["exceptions"];
    const dateObj = calendarDateToDate(data.date);
    const targetDateObj = data.targetDate
      ? calendarDateToDate(data.targetDate)
      : null;
    if (targetDateObj && targetDateObj.getTime() === dateObj.getTime()) {
      throw new AppError("BAD_REQUEST", "La fecha destino debe ser diferente a la fecha original");
    }
    if (targetDateObj && block.date) {
      throw new AppError("BAD_REQUEST", "Solo los bloques recurrentes admiten una fecha destino");
    }

    const existingException = exceptions.find((exception) => calendarDateKey(exception.date) === calendarDateKey(dateObj));
    const sourceOccurrence = blockOccurrenceOn(block, dateObj, exceptions);
    if (!sourceOccurrence.occurs && !existingException) {
      throw new AppError("BAD_REQUEST", "La fecha de origen no tiene una ocurrencia de este bloque");
    }

    if (targetDateObj) {
      const targetException = exceptions.some(
        (exception) => exception.id !== existingException?.id
          && exception.action === "move"
          && exception.targetDate
          && calendarDateKey(exception.targetDate) === calendarDateKey(targetDateObj),
      );
      const targetOccurrence = blockOccurrenceOn(
        block,
        targetDateObj,
        exceptions.filter((exception) => exception.id !== existingException?.id),
      );
      if (targetException || targetOccurrence.occurs) {
        throw new AppError("CONFLICT", "La fecha destino ya tiene una ocurrencia de este bloque");
      }
    }

    if (data.action === "move") {
      const conflictDate = targetDateObj ?? dateObj;
      const candidate = {
        id,
        date: conflictDate,
        recurrenceStartsAt: null,
        startMin: data.startMin!,
        endMin: data.endMin!,
        createdAt: block.createdAt,
        daysOfWeek: [dayOfWeek(conflictDate)],
        repeatEveryWeeks: 1,
        repeatEndsAt: null,
      } satisfies TimeBlockSeries["block"];
      await this.assertNoOverlap(userId, timeBlockSeries(candidate, block.name ?? undefined), id);
    }

    return prisma.timeBlockException.upsert({
      where: { blockId_date: { blockId: id, date: dateObj } },
      create: {
        blockId: id,
        userId,
        date: dateObj,
        targetDate: targetDateObj,
        action: data.action as any,
        startMin: data.startMin,
        endMin: data.endMin,
      },
      update: {
        targetDate: targetDateObj,
        action: data.action as any,
        startMin: data.startMin,
        endMin: data.endMin,
      },
    });
  }

  async listExceptions(userId: string, blockId: string) {
    await this.getById(userId, blockId);
    return prisma.timeBlockException.findMany({
      where: { userId, blockId },
      orderBy: { date: "asc" },
    });
  }

  async listAllExceptions(userId: string, from?: Date, to?: Date) {
    const dateRange = from || to
      ? { ...(from ? { gte: from } : {}), ...(to ? { lt: nextCalendarDayStart(to) } : {}) }
      : undefined;
    return prisma.timeBlockException.findMany({
      where: {
        userId,
        ...(dateRange ? { OR: [{ date: dateRange }, { targetDate: dateRange }] } : {}),
      },
      orderBy: { date: "asc" },
    });
  }

  async deleteException(userId: string, blockId: string, exceptionId: string) {
    await this.getById(userId, blockId);
    const exception = await prisma.timeBlockException.findFirst({
      where: { id: exceptionId, userId, blockId },
    });
    if (!exception) throw new AppError("NOT_FOUND", "Excepción no encontrada");
    await prisma.timeBlockException.delete({ where: { id: exceptionId } });
    return { success: true };
  }
}

export const timeBlockService = new TimeBlockService();
