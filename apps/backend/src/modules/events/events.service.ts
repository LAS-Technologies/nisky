import { prisma } from "../../infra/prisma/client";
import { AppError } from "../../utils/errors/handler";
import { DateTime } from "luxon";
import { blockOccurrenceOn, TIME_BLOCKS_TZ } from "../timeblocks/timeblocks.util";
import { expandEventOccurrences, eventOccurrenceOn } from "./events.util";
import type { CalendarEvent } from "../../infra/prisma/generated/prisma/client";
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

  private async assertNoBlockOverlap(userId: string, date: Date, startMin: number | null, endMin: number | null) {
    if (startMin === null || endMin === null) return;
    const dayExceptions = await prisma.timeBlockException.findMany({ where: { userId, date } });
    const blocks = await prisma.timeBlock.findMany({
      where: { userId },
      include: { project: { select: { name: true } } },
    });
    for (const block of blocks) {
      const occ = blockOccurrenceOn(block, date, dayExceptions);
      if (!occ.occurs) continue;
      const clash = occ.startMin < endMin && occ.endMin > startMin;
      if (!clash) continue;
      const label = block.name ?? block.project?.name ?? "bloque";
      const dayName = DateTime.fromJSDate(date, { zone: TIME_BLOCKS_TZ }).toFormat("EEE d MMM", { locale: "es" });
      const time = `${String(Math.floor(occ.startMin / 60)).padStart(2, "0")}:${String(occ.startMin % 60).padStart(2, "0")}–${String(Math.floor(occ.endMin / 60)).padStart(2, "0")}:${String(occ.endMin % 60).padStart(2, "0")}`;
      throw new AppError(
        "CONFLICT",
        `Choca con el bloque "${label}" (${dayName} ${time}). Muévelo en la Agenda o sáltalo ese día.`,
      );
    }
  }

  private async assertNoEventOverlap(userId: string, date: Date, startMin: number | null, endMin: number | null, excludeId?: string) {
    if (startMin === null || endMin === null) return;
    const sameDayEvents = await prisma.calendarEvent.findMany({
      where: { userId, id: excludeId ? { not: excludeId } : undefined },
      include: { exceptions: true },
    });
    const dayExceptions = await prisma.calendarEventException.findMany({ where: { userId, date } });
    for (const other of sameDayEvents) {
      const occ = eventOccurrenceOn(other, date, [...other.exceptions, ...dayExceptions]);
      if (!occ.occurs) continue;
      if (other.allDay && occ.exceptionAction !== "move") continue;
      const otherStart = occ.startMin ?? other.startMin;
      const otherEnd = occ.endMin ?? other.endMin;
      if (otherStart === null || otherStart === undefined || otherEnd === null || otherEnd === undefined) continue;
      if (otherStart < endMin && otherEnd > startMin) {
        throw new AppError("CONFLICT", `Ya tienes el evento «${other.title}» que se cruza con este horario`);
      }
    }
  }

  async create(userId: string, data: CreateEventDto) {
    const localDate = DateTime.fromISO(data.date, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate();
    const startMin = data.allDay ? null : data.startMin ?? null;
    const endMin = data.allDay ? null : data.endMin ?? null;
    await this.assertNoBlockOverlap(userId, localDate, startMin, endMin);
    await this.assertNoEventOverlap(userId, localDate, startMin, endMin);
    return prisma.calendarEvent.create({
      data: {
        userId,
        title: data.title,
        date: localDate,
        allDay: data.allDay,
        startMin,
        endMin,
        location: data.location,
        color: data.color ?? randomEventColor(),
        recurrenceType: data.recurrenceType ?? null,
        recurrenceInterval: data.recurrenceInterval ?? 1,
        recurrenceDaysOfWeek: data.recurrenceDaysOfWeek ?? [],
        recurrenceDayOfMonth: data.recurrenceDayOfMonth ?? null,
        recurrenceEndsAt: data.recurrenceEndsAt ? DateTime.fromISO(data.recurrenceEndsAt, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate() : null,
        remindBeforeMin: data.remindBeforeMin ?? 0,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateEventDto) {
    const current = await this.getById(userId, id);
    const localDate = data.date ? DateTime.fromISO(data.date, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate() : current.date;
    const allDay = data.allDay ?? current.allDay;
    const startMin = allDay ? null : (data.startMin ?? current.startMin);
    const endMin = allDay ? null : (data.endMin ?? current.endMin);
    await this.assertNoBlockOverlap(userId, localDate, startMin, endMin);
    await this.assertNoEventOverlap(userId, localDate, startMin, endMin, id);

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
        allDay,
        startMin,
        endMin,
        location: data.location,
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.recurrenceType !== undefined ? { recurrenceType: data.recurrenceType } : {}),
        ...(data.recurrenceInterval !== undefined ? { recurrenceInterval: data.recurrenceInterval } : {}),
        ...(data.recurrenceDaysOfWeek !== undefined ? { recurrenceDaysOfWeek: data.recurrenceDaysOfWeek } : {}),
        ...(data.recurrenceDayOfMonth !== undefined ? { recurrenceDayOfMonth: data.recurrenceDayOfMonth } : {}),
        ...(data.recurrenceEndsAt !== undefined ? { recurrenceEndsAt: data.recurrenceEndsAt ? DateTime.fromISO(data.recurrenceEndsAt, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate() : null } : {}),
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
    await this.getById(userId, id);
    const dateObj = DateTime.fromISO(data.date, { zone: TIME_BLOCKS_TZ }).startOf("day").toJSDate();

    if (data.action === "move" && data.startMin !== undefined && data.endMin !== undefined) {
      const sameDayBlocks = await prisma.timeBlockException.findMany({ where: { userId, date: dateObj } });
      const blocks = await prisma.timeBlock.findMany({ where: { userId } });
      for (const block of blocks) {
        const occ = blockOccurrenceOn(block, dateObj, sameDayBlocks);
        if (!occ.occurs || occ.startMin >= data.endMin || occ.endMin <= data.startMin) continue;
        throw new AppError("CONFLICT", "Ya tienes un bloque que se cruza con este horario");
      }
      const sameDayEvents = await prisma.calendarEvent.findMany({
        where: { userId, date: dateObj, id: { not: id } },
        include: { exceptions: true },
      });
      const eventClash = sameDayEvents.some((event) => {
        const occ = eventOccurrenceOn(event, dateObj, event.exceptions);
        if (!occ.occurs) return false;
        if (event.allDay && occ.exceptionAction !== "move") return false;
        const occStart = occ.startMin;
        const occEnd = occ.endMin;
        if (occStart === null || occStart === undefined || occEnd === null || occEnd === undefined) return false;
        return occStart < data.endMin! && occEnd > data.startMin!;
      });
      if (eventClash) {
        throw new AppError("CONFLICT", "Ya tienes un evento que se cruza con este horario");
      }
    }

    return prisma.calendarEventException.upsert({
      where: { eventId_date: { eventId: id, date: dateObj } },
      create: { eventId: id, userId, date: dateObj, action: data.action, startMin: data.startMin, endMin: data.endMin },
      update: { action: data.action, startMin: data.startMin, endMin: data.endMin },
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
