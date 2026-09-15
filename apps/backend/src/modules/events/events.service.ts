import { prisma } from "../../infra/prisma/client";
import { AppError } from "../../utils/errors/handler";
import { calendarDateKey, calendarDateToDate, calendarDayStart } from "../../utils/calendar-date";
import { findCalendarConflict, type CalendarConflict, type EventSeries, type TimeBlockSeries } from "../../utils/calendar/recurrence-overlap";
import { DateTime } from "luxon";
import { TIME_BLOCKS_TZ, type TimeBlockExceptionRow } from "../timeblocks/timeblocks.util";
import { expandEventOccurrences, eventOccurrenceOn } from "./events.util";
import type { CalendarEvent } from "../../infra/prisma/generated/prisma/client";
import type { CalendarEventException } from "../../infra/prisma/generated/prisma/client";
import type { CreateEventDto, CreateEventExceptionDto, UpdateEventDto } from "./events.validator";

const EVENT_COLORS = [
  "#303e51",
  "#006d77",
  "#8b5e3c",
  "#6b4f4f",
  "#2d5a27",
  "#5c1a1a",
  "#1a3a5c",
  "#4a4a2a",
];

function randomEventColor() {
  return EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)];
}

type CalendarEventRow = CalendarEvent & { exceptions?: CalendarEventException[] };

type TimeBlockRow = TimeBlockSeries["block"] & {
  name?: string | null;
  project?: { name: string } | null;
  exceptions?: TimeBlockExceptionRow[];
};

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
  const prefix = conflict.kind === "TIME_BLOCK" ? "Choca con el bloque" : "Ya tienes el evento";
  return `${prefix} «${conflict.label}»`;
}

export type EventOccurrenceWithBase = CalendarEvent & {
  date: Date;
  baseDate: Date;
  baseStartMin: number | null;
  baseEndMin: number | null;
  isException: boolean;
  exceptionAction?: "skip" | "move";
};

export class EventsService {
  async list(userId: string, from: Date, to: Date) {
    const baseEvents = await prisma.calendarEvent.findMany({
      where: { userId },
      include: { exceptions: true },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    });

    const allOccurrences: EventOccurrenceWithBase[] = [];

    for (const event of baseEvents) {
      const occs = expandEventOccurrences(event, from, to, event.exceptions);
      for (const occ of occs) {
        allOccurrences.push({
          ...event,
          date: occ.date,
          baseDate: event.date,
          baseStartMin: event.startMin,
          baseEndMin: event.endMin,
          startMin: occ.startMin,
          endMin: occ.endMin,
          isException: occ.isException,
          exceptionAction: occ.exceptionAction,
        });
      }
    }

    return allOccurrences.sort(
      (a, b) => a.date.getTime() - b.date.getTime() || (a.startMin ?? 0) - (b.startMin ?? 0),
    );
  }

  async today(userId: string) {
    const todayStart = DateTime.now().setZone(TIME_BLOCKS_TZ).startOf("day").toJSDate();
    const tomorrowStart = DateTime.now().setZone(TIME_BLOCKS_TZ).plus({ days: 1 }).startOf("day").toJSDate();
    const baseEvents = await prisma.calendarEvent.findMany({
      where: { userId },
      include: { exceptions: true },
    });
    const now = new Date();
    return baseEvents
      .filter((event) => eventOccurrenceOn(event, now, event.exceptions).occurs)
      .map((event) => ({
        ...event,
        date: todayStart,
        baseDate: event.date,
        baseStartMin: event.startMin,
        baseEndMin: event.endMin,
        isException: false,
        exceptionAction: undefined,
      }))
      .sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
  }

  async getById(userId: string, id: string) {
    const event = await prisma.calendarEvent.findFirst({ where: { id, userId } });
    if (!event) throw new AppError("NOT_FOUND", "Evento no encontrado");
    return event;
  }

  private async assertNoOverlap(userId: string, candidate: EventSeries, excludeId?: string) {
    const [blocks, events] = await Promise.all([
      prisma.timeBlock.findMany({
        where: { userId },
        include: { project: { select: { name: true } }, exceptions: true },
      }),
      prisma.calendarEvent.findMany({
        where: { userId, id: excludeId ? { not: excludeId } : undefined },
        include: { exceptions: true },
      }),
    ]);
    const existing = [
      ...blocks.map((block) => ({
        kind: "TIME_BLOCK" as const,
        id: block.id,
        label: (block as TimeBlockRow).name ?? (block as TimeBlockRow).project?.name ?? "bloque",
        block: block as TimeBlockRow,
        exceptions: ((block as TimeBlockRow).exceptions ?? []) as TimeBlockSeries["exceptions"],
      })),
      ...events.map((event) => eventSeries(event as CalendarEventRow)),
    ];
    const conflict = findCalendarConflict(candidate, existing);
    if (conflict) throw new AppError("CONFLICT", conflictMessage(conflict), conflict);
  }

  async create(userId: string, data: CreateEventDto) {
    const localDate = calendarDateToDate(data.date);
    const startMin = data.allDay ? null : data.startMin ?? null;
    const endMin = data.allDay ? null : data.endMin ?? null;
    const recurrenceType = data.recurrenceType ?? null;
    const recurrenceStartsAt = recurrenceType ? localDate : null;
    const recurrenceEndsAt = recurrenceType && data.recurrenceEndsAt
      ? calendarDateToDate(data.recurrenceEndsAt)
      : null;
    if (recurrenceEndsAt && recurrenceEndsAt < calendarDayStart(localDate)) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior al inicio del evento");
    }
    const now = new Date();
    const candidate = {
      id: "new-calendar-event",
      userId,
      title: data.title,
      date: localDate,
      recurrenceStartsAt,
      allDay: data.allDay,
      startMin,
      endMin,
      location: data.location ?? null,
      color: data.color ?? null,
      recurrenceType,
      recurrenceInterval: data.recurrenceInterval ?? 1,
      recurrenceDaysOfWeek: data.recurrenceDaysOfWeek ?? [],
      recurrenceDayOfMonth: data.recurrenceDayOfMonth ?? null,
      recurrenceEndsAt,
      remindBeforeMin: data.remindBeforeMin ?? 0,
      lastRemindNotifiedAt: null,
      lastStartNotifiedAt: null,
      lastEndWarnNotifiedAt: null,
      createdAt: now,
      updatedAt: now,
    } as CalendarEvent;
    await this.assertNoOverlap(userId, eventSeries(candidate));
    return prisma.calendarEvent.create({
      data: {
        userId,
        title: data.title,
        date: localDate,
        recurrenceStartsAt,
        allDay: data.allDay,
        startMin,
        endMin,
        location: data.location,
        color: data.color ?? randomEventColor(),
        recurrenceType,
        recurrenceInterval: data.recurrenceInterval ?? 1,
        recurrenceDaysOfWeek: data.recurrenceDaysOfWeek ?? [],
        recurrenceDayOfMonth: data.recurrenceDayOfMonth ?? null,
        recurrenceEndsAt,
        remindBeforeMin: data.remindBeforeMin ?? 0,
      },
    });
  }

  private async updateFromDate(userId: string, id: string, data: UpdateEventDto) {
    const current = await this.getById(userId, id);
    if (!current.recurrenceType) {
      throw new AppError("BAD_REQUEST", "Solo los eventos recurrentes admiten cambios futuros");
    }

    const effectiveDate = DateTime.fromJSDate(calendarDateToDate(data.effectiveFrom!), { zone: TIME_BLOCKS_TZ }).startOf("day");
    const currentStart = DateTime.fromJSDate(current.recurrenceStartsAt ?? current.date, { zone: TIME_BLOCKS_TZ }).startOf("day");
    if (!effectiveDate.isValid || effectiveDate < currentStart) {
      throw new AppError("BAD_REQUEST", "La fecha de cambio no es válida para este evento");
    }

    const nextDate = data.date !== undefined
      ? DateTime.fromJSDate(calendarDateToDate(data.date), { zone: TIME_BLOCKS_TZ }).startOf("day")
      : effectiveDate;
    if (!nextDate.isValid || nextDate < currentStart) {
      throw new AppError("BAD_REQUEST", "La nueva fecha no es válida para este evento");
    }
    const splitDate = effectiveDate;
    if (current.recurrenceEndsAt && splitDate > DateTime.fromJSDate(current.recurrenceEndsAt, { zone: TIME_BLOCKS_TZ }).endOf("day")) {
      throw new AppError("BAD_REQUEST", "La fecha de cambio está después del final del evento");
    }

    const allDay = data.allDay ?? current.allDay;
    const startMin = allDay ? null : data.startMin ?? current.startMin;
    const endMin = allDay ? null : data.endMin ?? current.endMin;
    const recurrenceType = data.recurrenceType !== undefined ? data.recurrenceType : current.recurrenceType;
    const recurrenceInterval = data.recurrenceInterval ?? current.recurrenceInterval;
    const recurrenceDaysOfWeek = data.recurrenceDaysOfWeek ?? current.recurrenceDaysOfWeek;
    const recurrenceDayOfMonth = data.recurrenceDayOfMonth !== undefined
      ? data.recurrenceDayOfMonth
      : current.recurrenceDayOfMonth;
    const recurrenceEndsAt = data.recurrenceEndsAt === undefined
      ? current.recurrenceEndsAt
      : data.recurrenceEndsAt
        ? calendarDateToDate(data.recurrenceEndsAt)
        : null;
    const nextRecurrenceEndsAt = recurrenceType ? recurrenceEndsAt : null;
    if (nextRecurrenceEndsAt && nextRecurrenceEndsAt < splitDate.toJSDate()) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior a la fecha de cambio");
    }

    const now = new Date();
    const candidate = {
      ...current,
      id,
      date: nextDate.toJSDate(),
      recurrenceStartsAt: recurrenceType ? effectiveDate.toJSDate() : null,
      allDay,
      startMin,
      endMin,
      recurrenceType,
      recurrenceInterval,
      recurrenceDaysOfWeek,
      recurrenceDayOfMonth,
      recurrenceEndsAt: nextRecurrenceEndsAt,
      createdAt: current.createdAt ?? now,
      updatedAt: now,
    } as CalendarEvent;
    await this.assertNoOverlap(userId, eventSeries(candidate), id);

    const splitDateValue = splitDate.toJSDate();
    const effectiveDateValue = effectiveDate.toJSDate();
    return prisma.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id },
        data: { recurrenceEndsAt: splitDate.minus({ days: 1 }).toJSDate() },
      });
      const created = await tx.calendarEvent.create({
        data: {
          userId: current.userId,
          title: data.title ?? current.title,
          date: nextDate.toJSDate(),
          recurrenceStartsAt: recurrenceType ? effectiveDate.toJSDate() : null,
          allDay,
          startMin,
          endMin,
          location: data.location !== undefined ? data.location : current.location,
          color: data.color !== undefined ? data.color : current.color,
          recurrenceType,
          recurrenceInterval,
          recurrenceDaysOfWeek,
          recurrenceDayOfMonth,
          recurrenceEndsAt: nextRecurrenceEndsAt,
          remindBeforeMin: data.remindBeforeMin ?? current.remindBeforeMin,
          lastRemindNotifiedAt: null,
          lastStartNotifiedAt: null,
          lastEndWarnNotifiedAt: null,
        },
      });
      const carriedExceptions = await tx.calendarEventException.findMany({
        where: { eventId: id, date: { lt: splitDateValue }, targetDate: { gte: splitDateValue } },
      });
      await tx.calendarEventException.updateMany({
        where: { eventId: id, date: { gte: splitDateValue } },
        data: { eventId: created.id },
      });
      for (const exception of carriedExceptions) {
        await tx.calendarEventException.create({
          data: {
            eventId: created.id,
            userId: exception.userId,
            date: exception.date,
            targetDate: exception.targetDate,
            action: exception.action,
            startMin: exception.startMin,
            endMin: exception.endMin,
          },
        });
      }
      if (nextDate < effectiveDate) {
        await tx.calendarEventException.upsert({
          where: { eventId_date: { eventId: created.id, date: effectiveDateValue } },
          create: {
            eventId: created.id,
            userId: current.userId,
            date: effectiveDateValue,
            targetDate: nextDate.toJSDate(),
            action: "move",
            startMin: allDay ? null : startMin,
            endMin: allDay ? null : endMin,
          },
          update: {
            targetDate: nextDate.toJSDate(),
            action: "move",
            startMin: allDay ? null : startMin,
            endMin: allDay ? null : endMin,
          },
        });
      }
      return created;
    });
  }

  async update(userId: string, id: string, data: UpdateEventDto) {
    if (data.effectiveFrom !== undefined) return this.updateFromDate(userId, id, data);
    const current = await this.getById(userId, id);
    const localDate = data.date ? calendarDateToDate(data.date) : current.date;
    const allDay = data.allDay ?? current.allDay;
    const startMin = allDay ? null : (data.startMin ?? current.startMin);
    const endMin = allDay ? null : (data.endMin ?? current.endMin);
    const recurrenceType = data.recurrenceType !== undefined ? data.recurrenceType : current.recurrenceType;
    const recurrenceStartsAt = recurrenceType
      ? data.date !== undefined ? localDate : current.recurrenceStartsAt ?? current.date
      : null;
    const recurrenceEndsAt = recurrenceType
      ? data.recurrenceEndsAt === undefined
        ? current.recurrenceEndsAt
        : data.recurrenceEndsAt
          ? calendarDateToDate(data.recurrenceEndsAt)
          : null
      : null;
    if (recurrenceEndsAt && recurrenceEndsAt < calendarDayStart(recurrenceStartsAt!)) {
      throw new AppError("BAD_REQUEST", "La fecha final debe ser igual o posterior al inicio del evento");
    }
    const candidate = {
      ...current,
      date: localDate,
      recurrenceStartsAt,
      allDay,
      startMin,
      endMin,
      recurrenceType,
      recurrenceInterval: data.recurrenceInterval ?? current.recurrenceInterval,
      recurrenceDaysOfWeek: data.recurrenceDaysOfWeek ?? current.recurrenceDaysOfWeek,
      recurrenceDayOfMonth: data.recurrenceDayOfMonth !== undefined
        ? data.recurrenceDayOfMonth
        : current.recurrenceDayOfMonth,
      recurrenceEndsAt,
    } as CalendarEvent;
    await this.assertNoOverlap(userId, eventSeries(candidate), id);

    const timingChanged =
      data.date !== undefined ||
      data.startMin !== undefined ||
      data.endMin !== undefined ||
      data.recurrenceType !== undefined ||
      data.recurrenceInterval !== undefined ||
      data.recurrenceDaysOfWeek !== undefined ||
      data.recurrenceDayOfMonth !== undefined ||
      data.recurrenceEndsAt !== undefined ||
      data.remindBeforeMin !== undefined;

    return prisma.calendarEvent.update({
      where: { id },
      data: {
        title: data.title,
        date: localDate,
        recurrenceStartsAt,
        allDay,
        startMin,
        endMin,
        location: data.location,
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.recurrenceType !== undefined ? { recurrenceType } : {}),
        ...(data.recurrenceInterval !== undefined ? { recurrenceInterval: data.recurrenceInterval } : {}),
        ...(data.recurrenceDaysOfWeek !== undefined ? { recurrenceDaysOfWeek: data.recurrenceDaysOfWeek } : {}),
        ...(data.recurrenceDayOfMonth !== undefined ? { recurrenceDayOfMonth: data.recurrenceDayOfMonth } : {}),
        ...(data.recurrenceEndsAt !== undefined ? { recurrenceEndsAt } : {}),
        ...(data.remindBeforeMin !== undefined ? { remindBeforeMin: data.remindBeforeMin } : {}),
        ...(timingChanged
          ? { lastRemindNotifiedAt: null, lastStartNotifiedAt: null, lastEndWarnNotifiedAt: null }
          : {}),
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await prisma.calendarEvent.delete({ where: { id } });
    return { success: true };
  }

  async createException(userId: string, id: string, data: CreateEventExceptionDto) {
    const event = await prisma.calendarEvent.findFirst({ where: { id, userId }, include: { exceptions: true } });
    if (!event) throw new AppError("NOT_FOUND", "Evento no encontrado");
    const eventRow = event as CalendarEventRow;
    const exceptions = eventRow.exceptions ?? [];
    const dateObj = calendarDateToDate(data.date);
    const targetDateObj = data.targetDate
      ? calendarDateToDate(data.targetDate)
      : null;
    if (targetDateObj && targetDateObj.getTime() === dateObj.getTime()) {
      throw new AppError("BAD_REQUEST", "La fecha destino debe ser diferente a la fecha original");
    }
    if (targetDateObj && !event.recurrenceType) {
      throw new AppError("BAD_REQUEST", "Solo los eventos recurrentes admiten una fecha destino");
    }
    const existingException = exceptions.find((exception) => calendarDateKey(exception.date) === calendarDateKey(dateObj));
    const sourceOccurrence = eventOccurrenceOn(event, dateObj, exceptions);
    if (!sourceOccurrence.occurs && !existingException) {
      throw new AppError("BAD_REQUEST", "La fecha de origen no tiene una ocurrencia de este evento");
    }

    if (targetDateObj) {
      const targetException = exceptions.some(
        (exception) => exception.id !== existingException?.id
          && exception.action === "move"
          && exception.targetDate
          && calendarDateKey(exception.targetDate) === calendarDateKey(targetDateObj),
      );
      const targetOccurrence = eventOccurrenceOn(event, targetDateObj, exceptions.filter((exception) => exception.id !== existingException?.id));
      if (targetException || targetOccurrence.occurs) {
        throw new AppError("CONFLICT", "La fecha destino ya tiene una ocurrencia de este evento");
      }
    }

    const moveStartMin = data.action === "move" && !event.allDay
      ? data.startMin ?? event.startMin
      : null;
    const moveEndMin = data.action === "move" && !event.allDay
      ? data.endMin ?? event.endMin
      : null;
    if (data.action === "move" && !event.allDay && (moveStartMin === null || moveEndMin === null)) {
      throw new AppError("BAD_REQUEST", "Un evento con horario requiere startMin y endMin");
    }
    if (moveStartMin !== null && moveEndMin !== null && moveEndMin <= moveStartMin) {
      throw new AppError("BAD_REQUEST", "El fin debe ser mayor al inicio");
    }

    if (data.action === "move") {
      const conflictDate = targetDateObj ?? dateObj;
      const candidate = {
        ...event,
        id,
        date: conflictDate,
        recurrenceStartsAt: null,
        recurrenceType: null,
        recurrenceInterval: 1,
        recurrenceDaysOfWeek: [],
        recurrenceDayOfMonth: null,
        recurrenceEndsAt: null,
        startMin: moveStartMin,
        endMin: moveEndMin,
      } as CalendarEvent;
      await this.assertNoOverlap(userId, eventSeries(candidate), id);
    }

    return prisma.calendarEventException.upsert({
      where: { eventId_date: { eventId: id, date: dateObj } },
      create: {
        eventId: id,
        userId,
        date: dateObj,
        targetDate: targetDateObj,
        action: data.action,
        startMin: data.action === "move" ? moveStartMin : null,
        endMin: data.action === "move" ? moveEndMin : null,
      },
      update: {
        targetDate: targetDateObj,
        action: data.action,
        startMin: data.action === "move" ? moveStartMin : null,
        endMin: data.action === "move" ? moveEndMin : null,
      },
    });
  }

  async listExceptions(userId: string, eventId: string) {
    await this.getById(userId, eventId);
    return prisma.calendarEventException.findMany({
      where: { userId, eventId },
      orderBy: { date: "asc" },
    });
  }

  async deleteException(userId: string, eventId: string, exceptionId: string) {
    await this.getById(userId, eventId);
    const exc = await prisma.calendarEventException.findFirst({ where: { id: exceptionId, userId, eventId } });
    if (!exc) throw new AppError("NOT_FOUND", "Excepción no encontrada");
    await prisma.calendarEventException.delete({ where: { id: exceptionId } });
    return { success: true };
  }
}

export const eventsService = new EventsService();
