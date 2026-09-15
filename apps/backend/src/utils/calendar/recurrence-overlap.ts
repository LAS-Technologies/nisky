import { DateTime } from "luxon";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";
import { calendarDateKey } from "../calendar-date";
import { blockOccurrenceOn, type TimeBlockExceptionRow, type TimeBlockOccurrence } from "../../modules/timeblocks/timeblocks.util";
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
  return DateTime.fromJSDate(value, { zone: "America/Santo_Domingo" }).startOf("day");
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

function exceptionTail(series: CalendarSeries) {
  const dates = series.exceptions.flatMap((exception) => [exception.date, exception.targetDate].filter((value): value is Date => Boolean(value)));
  return dates.reduce<Date | null>((latest, value) => (!latest || value > latest ? value : latest), null);
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

function pairConflict(candidate: CalendarSeries, existing: CalendarSeries): CalendarConflict | null {
  if (candidate.kind === "EVENT" && candidate.event.allDay) return null;
  if (existing.kind === "EVENT" && existing.event.allDay) return null;
  const candidateStart = seriesStart(candidate);
  const existingStart = seriesStart(existing);
  let day = localDay(maxDate(candidateStart, existingStart));
  const candidateEnd = seriesEnd(candidate);
  const existingEnd = seriesEnd(existing);
  const end = candidateEnd && existingEnd
    ? localDay(minDate(candidateEnd, existingEnd))
    : candidateEnd
      ? localDay(candidateEnd)
      : existingEnd
        ? localDay(existingEnd)
        : null;
  const tail = [exceptionTail(candidate), exceptionTail(existing)].reduce<Date | null>(
    (latest, value) => (!value || (latest && latest >= value) ? latest : value),
    null,
  );
  const seen = new Set<string>();

  for (let steps = 0; ; steps += 1) {
    if (end && day > end) return null;
    const dayValue = day.toJSDate();
    const candidateOccurrence = occurrenceOn(candidate, dayValue);
    const existingOccurrence = occurrenceOn(existing, dayValue);
    if (candidateOccurrence && existingOccurrence && overlaps(candidateOccurrence, existingOccurrence)) {
      return conflictFrom(existing, existingOccurrence);
    }

    const cycleAllowed = !tail || dayValue > tail;
    if (cycleAllowed) {
      const key = `${stateKey(candidate, dayValue)}|${stateKey(existing, dayValue)}`;
      if (seen.has(key)) return null;
      seen.add(key);
    }

    if (steps >= MAX_CYCLE_STEPS) {
      throw new Error("No se pudo completar la validación de solapamientos recurrentes");
    }
    day = day.plus({ days: 1 });
  }
}

export function findCalendarConflict(candidate: CalendarSeries, existing: CalendarSeries[]) {
  const conflicts = existing
    .filter((series) => series.id !== candidate.id)
    .map((series) => pairConflict(candidate, series))
    .filter((conflict): conflict is CalendarConflict => conflict !== null);
  conflicts.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.id.localeCompare(b.id));
  return conflicts[0] ?? null;
}
