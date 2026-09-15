import { DateTime } from "luxon";
import { weeksBetween } from "../../utils/recurrence";

export const TIME_BLOCKS_TZ = "America/Santo_Domingo";

export function nowMinutes(now: Date = new Date(), zone = TIME_BLOCKS_TZ): number {
  const local = DateTime.fromJSDate(now, { zone });
  return local.hour * 60 + local.minute;
}

export function dayOfWeek(now: Date = new Date(), zone = TIME_BLOCKS_TZ): number {
  const local = DateTime.fromJSDate(now, { zone });
  return local.weekday % 7;
}

export interface TimeBlockOccurrence {
  id: string;
  date?: Date | null;
  recurrenceStartsAt?: Date | null;
  startMin: number;
  endMin: number;
  createdAt: Date;
  daysOfWeek: number[];
  repeatEveryWeeks: number;
  repeatEndsAt: Date | null;
}

export type TimeBlockExceptionRow = {
  id: string;
  blockId: string;
  action: "skip" | "move" | string;
  startMin: number | null;
  endMin: number | null;
  date: Date;
  targetDate?: Date | null;
};

export type BlockOccurrence = {
  occurs: true;
  startMin: number;
  endMin: number;
  exceptionId: string | null;
} | { occurs: false };

function sameDay(a: Date, b: Date, zone: string) {
  const da = DateTime.fromJSDate(a, { zone });
  const db = DateTime.fromJSDate(b, { zone });
  return da.year === db.year && da.month === db.month && da.day === db.day;
}

export function blockOccurrenceOn(
  block: TimeBlockOccurrence,
  date: Date = new Date(),
  exceptions: TimeBlockExceptionRow[] = [],
  zone = TIME_BLOCKS_TZ,
): BlockOccurrence {
  const exception = exceptions.find(e => e.blockId === block.id && sameDay(e.date, date, zone));
  if (exception) {
    if (exception.action === "skip") return { occurs: false };
    if (exception.action === "move" && exception.targetDate) return { occurs: false };
    if (exception.action === "move" && exception.startMin !== null && exception.endMin !== null) {
      return { occurs: true, startMin: exception.startMin, endMin: exception.endMin, exceptionId: exception.id };
    }
  }

  const movedOccurrence = exceptions.find(
    (item) => item.blockId === block.id
      && item.action === "move"
      && item.targetDate
      && sameDay(item.targetDate, date, zone),
  );
  if (movedOccurrence && movedOccurrence.startMin !== null && movedOccurrence.endMin !== null) {
    return {
      occurs: true,
      startMin: movedOccurrence.startMin,
      endMin: movedOccurrence.endMin,
      exceptionId: movedOccurrence.id,
    };
  }

  if (block.date && !sameDay(block.date, date, zone)) return { occurs: false };
  if (!block.date
    && DateTime.fromJSDate(date, { zone }).startOf("day") < DateTime.fromJSDate(block.recurrenceStartsAt ?? block.createdAt, { zone }).startOf("day")) {
    return { occurs: false };
  }
  if (!block.daysOfWeek.includes(dayOfWeek(date, zone))) return { occurs: false };
  const targetDay = DateTime.fromJSDate(date, { zone }).startOf("day");
  if (block.repeatEndsAt && targetDay > DateTime.fromJSDate(block.repeatEndsAt, { zone }).startOf("day")) {
    return { occurs: false };
  }
  if (block.repeatEveryWeeks > 1) {
    const weeks = weeksBetween(block.recurrenceStartsAt ?? block.createdAt, date, zone);
    if (weeks % block.repeatEveryWeeks !== 0) return { occurs: false };
  }

  return { occurs: true, startMin: block.startMin, endMin: block.endMin, exceptionId: null };
}
