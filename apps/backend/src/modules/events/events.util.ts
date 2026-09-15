import { DateTime } from "luxon";
import { TIME_BLOCKS_TZ } from "../timeblocks/timeblocks.util";
import { calendarDateToDate } from "../../utils/calendar-date";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";

export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type EventOccurrence = {
  occurs: boolean;
  startMin?: number | null;
  endMin?: number | null;
  isException: boolean;
  exceptionAction?: "skip" | "move";
};

function dayInTz(value: Date, zone = TIME_BLOCKS_TZ) {
  return DateTime.fromJSDate(value, { zone }).startOf("day");
}

export function parseEventDate(value: string) {
  return calendarDateToDate(value);
}

export function eventOccurrenceOn(
  event: CalendarEvent,
  targetDate: Date,
  exceptions: CalendarEventException[] = [],
): EventOccurrence {
  const eventDate = dayInTz(event.date);
  const target = dayInTz(targetDate);
  const ownExceptions = exceptions.filter((exception) => exception.eventId === event.id);

  const exc = ownExceptions.find((e) => dayInTz(e.date).hasSame(target, "day"));
  if (exc) {
    if (exc.action === "skip") return { occurs: false, isException: true, exceptionAction: "skip" };
    if (exc.action === "move") {
      if (exc.targetDate) return { occurs: false, isException: true, exceptionAction: "move" };
      return { occurs: true, startMin: exc.startMin ?? null, endMin: exc.endMin ?? null, isException: true, exceptionAction: "move" };
    }
  }

  const movedOccurrence = ownExceptions.find(
    (e) => e.action === "move" && e.targetDate && dayInTz(e.targetDate).hasSame(target, "day"),
  );
  if (movedOccurrence) {
    return {
      occurs: true,
      startMin: movedOccurrence.startMin ?? null,
      endMin: movedOccurrence.endMin ?? null,
      isException: true,
      exceptionAction: "move",
    };
  }

  if (!event.recurrenceType) {
    return { occurs: eventDate.hasSame(target, "day"), startMin: event.startMin, endMin: event.endMin, isException: false };
  }

  const recurrenceStart = dayInTz(event.recurrenceStartsAt ?? event.date);
  if (event.recurrenceEndsAt && target > dayInTz(event.recurrenceEndsAt).endOf("day")) {
    return { occurs: false, isException: false };
  }

  if (target < recurrenceStart) return { occurs: false, isException: false };

  const interval = event.recurrenceInterval ?? 1;
  const diffDays = Math.floor(target.diff(recurrenceStart, "days").days);

  switch (event.recurrenceType) {
    case "DAILY":
      return diffDays % interval === 0
        ? { occurs: true, startMin: event.startMin, endMin: event.endMin, isException: false }
        : { occurs: false, isException: false };

    case "WEEKLY": {
      const targetDow = target.weekday % 7;
      // Recover weekly events saved without days by using their original weekday.
      const recurrenceDays = event.recurrenceDaysOfWeek?.length
        ? event.recurrenceDaysOfWeek
        : [eventDate.weekday % 7];
      const dowMatch = recurrenceDays.includes(targetDow);
      const weekDiff = Math.floor(target.startOf("week").diff(recurrenceStart.startOf("week"), "days").days / 7);
      return dowMatch && weekDiff % interval === 0
        ? { occurs: true, startMin: event.startMin, endMin: event.endMin, isException: false }
        : { occurs: false, isException: false };
    }

    case "MONTHLY": {
      const dayOfMonth = event.recurrenceDayOfMonth ?? recurrenceStart.day;
      const monthDiff = (target.year - recurrenceStart.year) * 12 + (target.month - recurrenceStart.month);
      const targetDay = Math.min(dayOfMonth, target.daysInMonth ?? 31);
      return target.day === targetDay && monthDiff % interval === 0
        ? { occurs: true, startMin: event.startMin, endMin: event.endMin, isException: false }
        : { occurs: false, isException: false };
    }

    case "YEARLY": {
      const dayOfMonth = event.recurrenceDayOfMonth ?? recurrenceStart.day;
      const month = recurrenceStart.month;
      const yearDiff = target.year - recurrenceStart.year;
      return target.month === month && target.day === dayOfMonth && yearDiff % interval === 0
        ? { occurs: true, startMin: event.startMin, endMin: event.endMin, isException: false }
        : { occurs: false, isException: false };
    }

    default:
      return { occurs: false, isException: false };
  }
}

export type EventOccurrenceRow = {
  date: Date;
  startMin: number | null;
  endMin: number | null;
  isException: boolean;
  exceptionAction?: "skip" | "move";
  baseEventId: string;
};

export function expandEventOccurrences(
  event: CalendarEvent,
  from: Date,
  to: Date,
  exceptions: CalendarEventException[] = [],
): EventOccurrenceRow[] {
  const results: EventOccurrenceRow[] = [];
  const ownExceptions = exceptions.filter((exception) => exception.eventId === event.id);
  const fromDt = dayInTz(from);
  const toDt = dayInTz(to).endOf("day");
  const eventDt = dayInTz(event.date);

  const movedIntoRange = ownExceptions.some(
    (exception) => exception.action === "move" && exception.targetDate
      && dayInTz(exception.targetDate) >= fromDt
      && dayInTz(exception.targetDate) <= toDt,
  );
  if (toDt < eventDt && !movedIntoRange) return [];

  const totalDays = Math.floor(toDt.diff(fromDt, "days").days) + 1;
  for (let i = 0; i < totalDays; i++) {
    const day = fromDt.plus({ days: i });
    const occ = eventOccurrenceOn(event, day.toJSDate(), ownExceptions);
    if (occ.occurs) {
      results.push({
        date: day.toJSDate(),
        startMin: occ.startMin ?? event.startMin ?? 0,
        endMin: occ.endMin ?? event.endMin ?? 0,
        isException: occ.isException,
        exceptionAction: occ.exceptionAction,
        baseEventId: event.id,
      });
    }
    if (event.recurrenceEndsAt && day > dayInTz(event.recurrenceEndsAt).endOf("day")) break;
  }
  return results;
}
