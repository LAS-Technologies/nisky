import type { TimeBlock, TimeBlockException } from "@/types/entities";
import { calendarDateFromInstant, parseDateOnly, toDateKey } from "./time";

export type TimeBlockOccurrence = {
  startMin: number;
  endMin: number;
  exception: TimeBlockException | null;
};

export function sameLocalDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function monday(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

export function findTimeBlockException(
  block: TimeBlock,
  date: Date,
  exceptions: TimeBlockException[] = [],
) {
  return exceptions.find(
    (exception) => exception.blockId === block.id && sameLocalDay(parseDateOnly(exception.date), date),
  );
}

function findMovedTimeBlockException(
  block: TimeBlock,
  date: Date,
  exceptions: TimeBlockException[],
) {
  return exceptions.find(
    (exception) => exception.blockId === block.id
      && exception.action === "move"
      && exception.targetDate
      && sameLocalDay(parseDateOnly(exception.targetDate), date),
  );
}

export function blockOccurrenceOn(
  block: TimeBlock,
  date: Date,
  exceptions: TimeBlockException[] = [],
): TimeBlockOccurrence | null {
  const exception = findTimeBlockException(block, date, exceptions);
  if (exception?.action === "skip") return null;
  if (exception?.action === "move") {
    if (exception.targetDate) return null;
    if (exception.startMin !== null && exception.endMin !== null) {
      return { startMin: exception.startMin, endMin: exception.endMin, exception };
    }
    return null;
  }

  const movedException = findMovedTimeBlockException(block, date, exceptions);
  if (movedException && movedException.startMin !== null && movedException.endMin !== null) {
    return {
      startMin: movedException.startMin,
      endMin: movedException.endMin,
      exception: movedException,
    };
  }

  if (block.date && !sameLocalDay(parseDateOnly(block.date), date)) return null;

  const recurrenceStart = block.recurrenceStartsAt
    ? parseDateOnly(block.recurrenceStartsAt)
    : calendarDateFromInstant(block.createdAt);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  if (!block.date && recurrenceStart.getTime() > dayStart.getTime()) return null;
  if (!block.daysOfWeek.includes(date.getDay())) return null;

  if (block.repeatEndsAt && parseDateOnly(block.repeatEndsAt).getTime() < dayStart.getTime()) return null;
  if (block.repeatEveryWeeks > 1) {
    const weeks = Math.floor((monday(date).getTime() - monday(recurrenceStart).getTime()) / (7 * 86_400_000));
    if (weeks < 0 || weeks % block.repeatEveryWeeks !== 0) return null;
  }

  return { startMin: block.startMin, endMin: block.endMin, exception: null };
}
