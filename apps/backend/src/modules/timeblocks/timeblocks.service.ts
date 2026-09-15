import { prisma } from "../../infra/prisma/client";
import { AppError } from "../../utils/errors/handler";
import { blockOccurrenceOn, dayOfWeek, nowMinutes, TIME_BLOCKS_TZ } from "./timeblocks.util";
import { DateTime } from "luxon";
import { eventOccurrenceOn } from "../events/events.util";
import type { CreateTimeBlockDto, UpdateTimeBlockDto, UpdateTimeBlockSettingsDto } from "./timeblocks.validator";

const settingsDefaults = {
  dayStartMin: 360,
  dayEndMin: 1380,
};

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
    daysOfWeek: number[],
    startMin: number,
    endMin: number,
    date: Date | null,
    excludeId?: string,
    fromDate?: Date,
  ) {
    if (date) {
      const [blocks, events, exceptions] = await Promise.all([
        prisma.timeBlock.findMany({
          where: { userId, id: excludeId ? { not: excludeId } : undefined },
          include: { project: { select: { name: true } } },
        }),
        prisma.calendarEvent.findMany({ where: { userId }, include: { exceptions: true } }),
        prisma.timeBlockException.findMany({
          where: { userId, OR: [{ date }, { targetDate: date }] },
        }),
      ]);
      const blockClash = blocks.find((block) => {
        const occurrence = blockOccurrenceOn(block, date, exceptions);
        return occurrence.occurs && occurrence.startMin < endMin && occurrence.endMin > startMin;
      });
      if (blockClash) {
        const label = blockClash.name ?? blockClash.project?.name ?? "bloque sin nombre";
        throw new AppError("CONFLICT", `Ya tienes un bloque que se cruza con «${label}»`);
      }
      const eventClash = events.some((event) => {
        const occurrence = eventOccurrenceOn(event, date, event.exceptions);
        if (!occurrence.occurs || event.allDay || occurrence.startMin == null || occurrence.endMin == null) return false;
        return occurrence.startMin < endMin && occurrence.endMin > startMin;
      });
      if (eventClash) {
        throw new AppError("CONFLICT", "Ya tienes un evento que se cruza con este horario");
      }
      return;
    }

    const recurrenceScope = fromDate
      ? {
          OR: [
            { date: { gte: fromDate } },
            { date: null, OR: [{ repeatEndsAt: null }, { repeatEndsAt: { gte: fromDate } }] },
          ],
        }
      : {};
    const overlapping = await prisma.timeBlock.findFirst({
      where: {
        userId,
        id: excludeId ? { not: excludeId } : undefined,
        ...recurrenceScope,
        daysOfWeek: { hasSome: daysOfWeek },
        startMin: { lt: endMin },
        endMin: { gt: startMin },
      },
      include: { project: { select: { name: true } } },
    });
    if (overlapping) {
      const label = overlapping.name ?? overlapping.project?.name ?? "bloque sin nombre";
      throw new AppError("CONFLICT", `Ya tienes un bloque que se cruza con «${label}»`);
    }

    const exceptions = await prisma.timeBlockException.findMany({
      where: {
        userId,
        action: "move",
        blockId: excludeId ? { not: excludeId } : undefined,
      },
      include: {
        block: {
          select: {
            name: true,
            project: { select: { name: true } },
          },
        },
      },
    });
    const exceptionClash = exceptions.find(
      (exc) => {
        const occurrenceDate = exc.targetDate ?? exc.date;
        if (fromDate) {
          const occurrenceDay = DateTime.fromJSDate(occurrenceDate, { zone: TIME_BLOCKS_TZ }).startOf("day");
          const firstDay = DateTime.fromJSDate(fromDate, { zone: TIME_BLOCKS_TZ }).startOf("day");
          if (occurrenceDay < firstDay) return false;
        }
        return daysOfWeek.includes(dayOfWeek(occurrenceDate)) &&
          exc.startMin !== null &&
          exc.endMin !== null &&
          exc.startMin < endMin &&
          exc.endMin > startMin;
      },
    );
    if (exceptionClash) {
      const label = exceptionClash.block.name ?? exceptionClash.block.project?.name ?? "bloque sin nombre";
      throw new AppError("CONFLICT", `Ya tienes un bloque que se cruza con «${label}»`);
    }

    const now = DateTime.now().setZone(TIME_BLOCKS_TZ).startOf("day").toJSDate();
    const eventFrom = fromDate ?? now;
    const futureEvents = await prisma.calendarEvent.findMany({
      where: {
        userId,
        OR: [
          { recurrenceType: null, date: { gte: eventFrom } },
          {
            recurrenceType: { not: null },
            OR: [{ recurrenceEndsAt: null }, { recurrenceEndsAt: { gte: eventFrom } }],
          },
        ],
      },
      select: { date: true, allDay: true, startMin: true, endMin: true },
    });
    const eventClash = futureEvents.some((event) => {
      if (!daysOfWeek.includes(dayOfWeek(event.date))) return false;
      if (event.allDay) return false;
      const eventStart = event.startMin ?? 0;
      const eventEnd = event.endMin ?? 24 * 60;
      return eventStart < endMin && eventEnd > startMin;
    });
    if (eventClash) {
      throw new AppError("CONFLICT", "Ya tienes un evento que se cruza con este horario");
    }
  }

  async create(userId: string, data: CreateTimeBlockDto) {
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, userId } });
      if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    }
    const blockDate = data.date
      ? DateTime.fromISO(data.date, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate()
      : null;
    await this.assertNoOverlap(userId, data.daysOfWeek, data.startMin, data.endMin, blockDate);
    return prisma.timeBlock.create({
      data: {
        userId,
        projectId: data.projectId ?? null,
        date: blockDate,
        recurrenceStartsAt: null,
        name: data.name ?? null,
        daysOfWeek: data.daysOfWeek,
        startMin: data.startMin,
        endMin: data.endMin,
        repeatEveryWeeks: data.repeatEveryWeeks ?? 1,
        repeatEndsAt: data.repeatEndsAt ? new Date(data.repeatEndsAt) : null,
        remindBeforeMin: data.remindBeforeMin ?? 0,
      },
    });
  }

  private async updateFromDate(userId: string, id: string, data: UpdateTimeBlockDto) {
    const current = await this.getById(userId, id);
    if (current.date) {
      throw new AppError("BAD_REQUEST", "Solo los bloques recurrentes admiten cambios futuros");
    }

    const effectiveDate = DateTime.fromISO(data.effectiveFrom!, { zone: TIME_BLOCKS_TZ }).startOf("day");
    const seriesStart = DateTime.fromJSDate(current.recurrenceStartsAt ?? current.createdAt, { zone: TIME_BLOCKS_TZ }).startOf("day");
    if (!effectiveDate.isValid || effectiveDate < seriesStart) {
      throw new AppError("BAD_REQUEST", "La fecha de cambio no es válida para este bloque");
    }
    if (current.repeatEndsAt && effectiveDate > DateTime.fromJSDate(current.repeatEndsAt, { zone: TIME_BLOCKS_TZ }).endOf("day")) {
      throw new AppError("BAD_REQUEST", "La fecha de cambio está después del final del bloque");
    }

    const isOneOff = data.date !== undefined && data.date !== null;
    const nextDate = isOneOff
      ? DateTime.fromISO(data.date!, { zone: TIME_BLOCKS_TZ }).startOf("day")
      : null;
    if (nextDate && (!nextDate.isValid || nextDate < effectiveDate)) {
      throw new AppError("BAD_REQUEST", "La nueva fecha debe ser igual o posterior a la fecha de cambio");
    }

    const daysOfWeek = data.daysOfWeek ?? current.daysOfWeek;
    const startMin = data.startMin ?? current.startMin;
    const endMin = data.endMin ?? current.endMin;
    const repeatEveryWeeks = data.repeatEveryWeeks ?? current.repeatEveryWeeks;
    const repeatEndsAt = data.repeatEndsAt === undefined
      ? current.repeatEndsAt
      : data.repeatEndsAt
        ? DateTime.fromISO(data.repeatEndsAt, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate()
        : null;
    if (repeatEndsAt && repeatEndsAt < effectiveDate.toJSDate()) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior a la fecha de cambio");
    }
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, userId } });
      if (!project) throw new AppError("NOT_FOUND", "Proyecto no encontrado");
    }

    await this.assertNoOverlap(
      userId,
      daysOfWeek,
      startMin,
      endMin,
      nextDate?.toJSDate() ?? null,
      id,
      effectiveDate.toJSDate(),
    );

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
    const daysOfWeek = data.daysOfWeek ?? current.daysOfWeek;
    const startMin = data.startMin ?? current.startMin;
    const endMin = data.endMin ?? current.endMin;
    const blockDate = data.date !== undefined
      ? (data.date ? DateTime.fromISO(data.date, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate() : null)
      : current.date;
    await this.assertNoOverlap(userId, daysOfWeek, startMin, endMin, blockDate, id);
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.daysOfWeek !== undefined ? { daysOfWeek: data.daysOfWeek } : {}),
        ...(data.startMin !== undefined ? { startMin: data.startMin } : {}),
        ...(data.endMin !== undefined ? { endMin: data.endMin } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.repeatEveryWeeks !== undefined ? { repeatEveryWeeks: data.repeatEveryWeeks } : {}),
        ...(data.repeatEndsAt !== undefined ? { repeatEndsAt: data.repeatEndsAt ? new Date(data.repeatEndsAt) : null } : {}),
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
    const block = await this.getById(userId, id);
    const dateObj = DateTime.fromISO(data.date, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate();
    const targetDateObj = data.targetDate
      ? DateTime.fromISO(data.targetDate, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate()
      : null;
    if (targetDateObj && targetDateObj.getTime() === dateObj.getTime()) {
      throw new AppError("BAD_REQUEST", "La fecha destino debe ser diferente a la fecha original");
    }
    if (targetDateObj && block.date) {
      throw new AppError("BAD_REQUEST", "Solo los bloques recurrentes admiten una fecha destino");
    }

    if (data.action === "move" && data.startMin !== undefined && data.endMin !== undefined) {
      const conflictDate = targetDateObj ?? dateObj;
      const sameDayExceptions = await prisma.timeBlockException.findMany({ where: { userId } });
      const blocks = await prisma.timeBlock.findMany({ where: { userId } });
      for (const block of blocks) {
        if (block.id === id) continue;
        const occ = blockOccurrenceOn(block, conflictDate, sameDayExceptions);
        if (!occ.occurs || occ.startMin >= data.endMin || occ.endMin <= data.startMin) continue;
        throw new AppError("CONFLICT", "Ya tienes un bloque que se cruza con este horario");
      }
      const sameDayEvents = await prisma.calendarEvent.findMany({
        where: { userId, date: conflictDate },
        select: { allDay: true, startMin: true, endMin: true },
      });
      const eventClash = sameDayEvents.some(
        (event) =>
          !event.allDay &&
          event.startMin !== null &&
          event.endMin !== null &&
          event.startMin < data.endMin! &&
          event.endMin! > data.startMin!,
      );
      if (eventClash) {
        throw new AppError("CONFLICT", "Ya tienes un evento que se cruza con este horario");
      }
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
      ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
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
