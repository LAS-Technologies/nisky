import { DateTime } from "luxon";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";
import { calendarDateKey } from "../calendar-date";
import { blockOccurrenceOn, TIME_BLOCKS_TZ, type TimeBlockExceptionRow, type TimeBlockOccurrence } from "../../modules/timeblocks/timeblocks.util";
import { eventOccurrenceOn } from "../../modules/events/events.util";

const CYCLE_YEARS = 400;
const MAX_CYCLE_STEPS = 200_000;

export type TimeBlockSeries = {
  kind: "TIME_BLOCK";
  id: string;
  label: string;
  block: TimeBlockOccurrence;
  exceptions: TimeBlockExceptionRow[];
};

export type EventSeries = {
  kind: "EVENT";
  id: string;
  label: string;
  event: CalendarEvent;
  exceptions: CalendarEventException[];
};

export type CalendarSeries = TimeBlockSeries | EventSeries;

export type CalendarConflict = {
  kind: CalendarSeries["kind"];
  id: string;
  label: string;
  date: string;
  startMin: number;
  endMin: number;
  source: "base" | "exception";
};

type Occurrence = {
  date: Date;
  startMin: number | null;
  endMin: number | null;
  source: "base" | "exception";
};

function localDay(value: Date) {
  return DateTime.fromJSDate(value, { zone: TIME_BLOCKS_TZ }).startOf("day");
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function dateDifferenceInDays(anchor: Date, target: Date) {
  return Math.floor(localDay(target).diff(localDay(anchor), "days").days);
}

function weekDifference(anchor: Date, target: Date) {
  return Math.floor(localDay(target).startOf("week").diff(localDay(anchor).startOf("week"), "weeks").weeks);
}

function monthDifference(anchor: Date, target: Date) {
  const start = localDay(anchor);
  const end = localDay(target);
  return (end.year - start.year) * 12 + end.month - start.month;
}

function yearDifference(anchor: Date, target: Date) {
  return localDay(target).year - localDay(anchor).year;
}

function positiveModulo(value: number, divisor: number) {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function dayOffset(dayOfWeek: number) {
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

function normalizedDays(days: number[]) {
  return [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
}

function alignedWeeks(weekDifferenceValue: number, interval: number) {
  const remainder = positiveModulo(weekDifferenceValue, interval);
  return remainder === 0 ? 0 : interval - remainder;
}

function seriesStart(series: CalendarSeries) {
  if (series.kind === "TIME_BLOCK") {
    return localDay(series.block.date ?? series.block.recurrenceStartsAt ?? series.block.createdAt).toJSDate();
  }
  return localDay(series.event.recurrenceStartsAt ?? series.event.date).toJSDate();
}

function seriesEnd(series: CalendarSeries) {
  if (series.kind === "TIME_BLOCK") {
    return series.block.date ?? series.block.repeatEndsAt;
  }
  return series.event.recurrenceType ? series.event.recurrenceEndsAt : series.event.date;
}

function recurrencePhase(series: CalendarSeries, date: Date) {
  if (series.kind === "TIME_BLOCK") {
    if (series.block.date) return "ONE";
    return `W${weekDifference(series.block.recurrenceStartsAt ?? series.block.createdAt, date) % Math.max(series.block.repeatEveryWeeks, 1)}`;
  }

  if (!series.event.recurrenceType) return "ONE";
  const anchor = series.event.recurrenceStartsAt ?? series.event.date;
  const interval = Math.max(series.event.recurrenceInterval ?? 1, 1);
  switch (series.event.recurrenceType) {
    case "DAILY":
      return `D${dateDifferenceInDays(anchor, date) % interval}`;
    case "WEEKLY":
      return `W${weekDifference(anchor, date) % interval}`;
    case "MONTHLY":
      return `M${monthDifference(anchor, date) % interval}`;
    case "YEARLY":
      return `Y${yearDifference(anchor, date) % interval}`;
    default:
      return "UNKNOWN";
  }
}

function nextWeeklyOccurrence(
  anchor: DateTime,
  from: DateTime,
  days: number[],
  interval: number,
  end: DateTime | null,
) {
  const recurrenceDays = normalizedDays(days);
  if (recurrenceDays.length === 0) return null;

  const first = from < anchor ? anchor : from;
  const anchorWeek = anchor.startOf("week");
  const firstWeek = first.startOf("week");
  const weekDifferenceValue = Math.floor(firstWeek.diff(anchorWeek, "weeks").weeks);
  const eligibleWeek = firstWeek.plus({ weeks: alignedWeeks(Math.max(weekDifferenceValue, 0), interval) });

  for (const day of recurrenceDays) {
    const occurrence = eligibleWeek.plus({ days: dayOffset(day) }).startOf("day");
    if (occurrence < first) continue;
    if (end && occurrence > end) return null;
    return occurrence;
  }

  const nextWeek = eligibleWeek.plus({ weeks: interval });
  const nextDay = nextWeek.plus({ days: dayOffset(recurrenceDays[0]!) }).startOf("day");
  return end && nextDay > end ? null : nextDay;
}

function nextMonthlyOccurrence(anchor: DateTime, from: DateTime, dayOfMonth: number, interval: number, end: DateTime | null) {
  const first = from < anchor ? anchor : from;
  const monthDifferenceValue = Math.max(0, (first.year - anchor.year) * 12 + first.month - anchor.month);
  let months = monthDifferenceValue + positiveModulo(-monthDifferenceValue, interval);
  let month = anchor.startOf("month").plus({ months });
  let occurrence = month.set({
    day: Math.min(dayOfMonth, month.daysInMonth ?? 31),
  }).startOf("day");
  if (occurrence < first) {
    months += interval;
    month = anchor.startOf("month").plus({ months });
    occurrence = month.set({
      day: Math.min(dayOfMonth, month.daysInMonth ?? 31),
    }).startOf("day");
  }
  return end && occurrence > end ? null : occurrence;
}

function nextYearlyOccurrence(anchor: DateTime, from: DateTime, interval: number, end: DateTime | null) {
  const first = from < anchor ? anchor : from;
  let years = Math.max(0, first.year - anchor.year);
  years += positiveModulo(-years, interval);

  for (let attempts = 0; attempts < 8; attempts += 1) {
    const occurrence = DateTime.fromObject(
      { year: anchor.year + years, month: anchor.month, day: anchor.day },
      { zone: TIME_BLOCKS_TZ },
    ).startOf("day");
    if (occurrence.isValid && occurrence >= first) {
      return end && occurrence > end ? null : occurrence;
    }
    years += interval;
  }

  return null;
}

function nextBaseOccurrence(series: CalendarSeries, from: Date): Date | null {
  const anchor = localDay(seriesStart(series));
  const first = localDay(from);
  const endValue = seriesEnd(series);
  const end = endValue ? localDay(endValue) : null;
  if (end && first > end) return null;

  if (series.kind === "TIME_BLOCK") {
    if (series.block.date) {
      return anchor >= first && (!end || anchor <= end) ? anchor.toJSDate() : null;
    }
    return nextWeeklyOccurrence(
      anchor,
      first,
      series.block.daysOfWeek,
      Math.max(series.block.repeatEveryWeeks, 1),
      end,
    )?.toJSDate() ?? null;
  }

  if (!series.event.recurrenceType) {
    return anchor >= first && (!end || anchor <= end) ? anchor.toJSDate() : null;
  }

  const interval = Math.max(series.event.recurrenceInterval ?? 1, 1);
  switch (series.event.recurrenceType) {
    case "DAILY": {
      const days = Math.max(0, Math.floor(first.diff(anchor, "days").days));
      const offset = positiveModulo(-days, interval);
      const occurrence = anchor.plus({ days: days + offset }).startOf("day");
      return end && occurrence > end ? null : occurrence.toJSDate();
    }
    case "WEEKLY": {
      const eventDate = localDay(series.event.date);
      const days = series.event.recurrenceDaysOfWeek?.length
        ? series.event.recurrenceDaysOfWeek
        : [eventDate.weekday % 7];
      return nextWeeklyOccurrence(anchor, first, days, interval, end)?.toJSDate() ?? null;
    }
    case "MONTHLY": {
      const dayOfMonth = series.event.recurrenceDayOfMonth ?? anchor.day ?? 1;
      return nextMonthlyOccurrence(anchor, first, dayOfMonth, interval, end)?.toJSDate() ?? null;
    }
    case "YEARLY":
      return nextYearlyOccurrence(anchor, first, interval, end)?.toJSDate() ?? null;
    default:
      return null;
  }
}

function baseOccurrenceDensity(series: CalendarSeries) {
  if (series.kind === "TIME_BLOCK") {
    if (series.block.date) return 0;
    return normalizedDays(series.block.daysOfWeek).length / (7 * Math.max(series.block.repeatEveryWeeks, 1));
  }
  if (!series.event.recurrenceType) return 0;

  const interval = Math.max(series.event.recurrenceInterval ?? 1, 1);
  switch (series.event.recurrenceType) {
    case "DAILY":
      return 1 / interval;
    case "WEEKLY":
      return (series.event.recurrenceDaysOfWeek?.length || 1) / (7 * interval);
    case "MONTHLY":
      return 1 / (31 * interval);
    case "YEARLY":
      return 1 / (366 * interval);
    default:
      return 0;
  }
}

function weeklyPattern(series: CalendarSeries) {
  if (series.kind === "TIME_BLOCK") {
    if (series.block.date) return null;
    return {
      days: normalizedDays(series.block.daysOfWeek),
      interval: Math.max(series.block.repeatEveryWeeks, 1),
      anchor: seriesStart(series),
    };
  }
  if (series.event.recurrenceType !== "WEEKLY") return null;
  const eventDate = localDay(series.event.date);
  return {
    days: normalizedDays(series.event.recurrenceDaysOfWeek?.length ? series.event.recurrenceDaysOfWeek : [eventDate.weekday % 7]),
    interval: Math.max(series.event.recurrenceInterval ?? 1, 1),
    anchor: seriesStart(series),
  };
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function basePatternsCanShareDate(candidate: CalendarSeries, existing: CalendarSeries) {
  const candidatePattern = weeklyPattern(candidate);
  const existingPattern = weeklyPattern(existing);
  if (!candidatePattern || !existingPattern) return true;
  if (!candidatePattern.days.some((day) => existingPattern.days.includes(day))) return false;

  const candidateWeek = localDay(candidatePattern.anchor).startOf("week");
  const existingWeek = localDay(existingPattern.anchor).startOf("week");
  const weekDifferenceValue = Math.floor(candidateWeek.diff(existingWeek, "weeks").weeks);
  return weekDifferenceValue % greatestCommonDivisor(candidatePattern.interval, existingPattern.interval) === 0;
}

function stateKey(series: CalendarSeries, date: Date) {
  const local = localDay(date);
  return `${((local.year % CYCLE_YEARS) + CYCLE_YEARS) % CYCLE_YEARS}-${local.month}-${local.day}:${recurrencePhase(series, date)}`;
}

function occurrenceOn(series: CalendarSeries, date: Date): Occurrence | null {
  if (series.kind === "TIME_BLOCK") {
    const occurrence = blockOccurrenceOn(series.block, date, series.exceptions);
    if (!occurrence.occurs) return null;
    return {
      date,
      startMin: occurrence.startMin,
      endMin: occurrence.endMin,
      source: occurrence.exceptionId ? "exception" : "base",
    };
  }

  const occurrence = eventOccurrenceOn(series.event, date, series.exceptions);
  if (!occurrence.occurs) return null;
  return {
    date,
    startMin: occurrence.startMin ?? null,
    endMin: occurrence.endMin ?? null,
    source: occurrence.isException ? "exception" : "base",
  };
}

function overlaps(a: Occurrence, b: Occurrence) {
  if (a.startMin === null || a.endMin === null || b.startMin === null || b.endMin === null) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function conflictFrom(series: CalendarSeries, occurrence: Occurrence): CalendarConflict {
  return {
    kind: series.kind,
    id: series.id,
    label: series.label,
    date: calendarDateKey(occurrence.date),
    startMin: occurrence.startMin!,
    endMin: occurrence.endMin!,
    source: occurrence.source,
  };
}

function conflictAt(candidate: CalendarSeries, existing: CalendarSeries, date: Date) {
  const candidateOccurrence = occurrenceOn(candidate, date);
  const existingOccurrence = occurrenceOn(existing, date);
  if (!candidateOccurrence || !existingOccurrence || !overlaps(candidateOccurrence, existingOccurrence)) return null;
  return conflictFrom(existing, existingOccurrence);
}

function earlierConflict(current: CalendarConflict | null, next: CalendarConflict | null) {
  if (!next) return current;
  if (!current) return next;
  if (next.date !== current.date) return next.date < current.date ? next : current;
  if (next.startMin !== current.startMin) return next.startMin < current.startMin ? next : current;
  return next.id < current.id ? next : current;
}

function exceptionDates(series: CalendarSeries) {
  const unique = new Map<string, Date>();
  for (const exception of series.exceptions) {
    for (const value of [exception.date, exception.targetDate]) {
      if (value) unique.set(calendarDateKey(value), localDay(value).toJSDate());
    }
  }
  return [...unique.values()].sort((a, b) => a.getTime() - b.getTime());
}

function baseTimeRange(series: CalendarSeries) {
  if (series.kind === "TIME_BLOCK") return { startMin: series.block.startMin, endMin: series.block.endMin };
  if (series.event.allDay || series.event.startMin === null || series.event.endMin === null) return null;
  return { startMin: series.event.startMin, endMin: series.event.endMin };
}

function pairConflict(candidate: CalendarSeries, existing: CalendarSeries): CalendarConflict | null {
  if (candidate.kind === "EVENT" && candidate.event.allDay) return null;
  if (existing.kind === "EVENT" && existing.event.allDay) return null;

  let firstConflict: CalendarConflict | null = null;
  for (const date of [...new Set([...exceptionDates(candidate), ...exceptionDates(existing)].map((value) => value.getTime()))]
    .sort((a, b) => a - b)
    .map((value) => new Date(value))) {
    firstConflict = earlierConflict(firstConflict, conflictAt(candidate, existing, date));
  }

  const candidateTime = baseTimeRange(candidate);
  const existingTime = baseTimeRange(existing);
  if (!candidateTime || !existingTime || candidateTime.startMin >= existingTime.endMin || existingTime.startMin >= candidateTime.endMin) {
    return firstConflict;
  }
  if (!basePatternsCanShareDate(candidate, existing)) return firstConflict;

  const candidateStart = seriesStart(candidate);
  const existingStart = seriesStart(existing);
  const day = localDay(maxDate(candidateStart, existingStart));
  const candidateEnd = seriesEnd(candidate);
  const existingEnd = seriesEnd(existing);
  const end = candidateEnd && existingEnd
    ? localDay(minDate(candidateEnd, existingEnd))
    : candidateEnd
      ? localDay(candidateEnd)
      : existingEnd
        ? localDay(existingEnd)
        : null;
  const sparse = baseOccurrenceDensity(candidate) <= baseOccurrenceDensity(existing) ? candidate : existing;
  const seen = new Set<string>();
  let occurrenceDate = nextBaseOccurrence(sparse, day.toJSDate());

  for (let steps = 0; occurrenceDate; steps += 1) {
    const occurrenceDay = localDay(occurrenceDate);
    if (end && occurrenceDay > end) break;
    const conflict = conflictAt(candidate, existing, occurrenceDate);
    if (conflict) return earlierConflict(firstConflict, conflict);

    const key = `${stateKey(candidate, occurrenceDate)}|${stateKey(existing, occurrenceDate)}`;
    if (seen.has(key)) break;
    seen.add(key);

    if (steps >= MAX_CYCLE_STEPS) {
      throw new Error("No se pudo completar la validación de solapamientos recurrentes");
    }
    occurrenceDate = nextBaseOccurrence(sparse, occurrenceDay.plus({ days: 1 }).toJSDate());
  }

  return firstConflict;
}

export function findCalendarConflict(candidate: CalendarSeries, existing: CalendarSeries[]) {
  const conflicts = existing
    .filter((series) => series.id !== candidate.id)
    .map((series) => pairConflict(candidate, series))
    .filter((conflict): conflict is CalendarConflict => conflict !== null);
  conflicts.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.id.localeCompare(b.id));
  return conflicts[0] ?? null;
}
