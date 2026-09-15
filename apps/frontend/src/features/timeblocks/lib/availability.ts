import type { CalendarEvent, TimeBlock, TimeBlockException } from "@/types/entities";
import { blockOccurrenceOn } from "./occurrences";
import { parseDateOnly, toDateKey } from "./time";

type SlotEvent = Pick<CalendarEvent, "date" | "allDay" | "startMin" | "endMin">;
type SlotBlock = TimeBlock;

function overlaps(startMin: number, endMin: number, otherStartMin: number, otherEndMin: number) {
  return otherStartMin < endMin && otherEndMin > startMin;
}

export function findAvailableStartMin({
  blocks,
  dateKey,
  durationMin = 60,
  events,
  preferredStartMin,
  exceptions = [],
}: {
  blocks: SlotBlock[];
  dateKey: string;
  durationMin?: number;
  events: SlotEvent[];
  preferredStartMin: number;
  exceptions?: TimeBlockException[];
}) {
  const maxStartMin = 24 * 60 - durationMin;
  const date = parseDateOnly(dateKey);

  for (let offsetMin = 0; offsetMin < 24 * 60; offsetMin += 15) {
    const startMin = (preferredStartMin + offsetMin) % (24 * 60);
    const endMin = startMin + durationMin;
    if (startMin > maxStartMin) continue;

    const eventConflict = events.some((event) => {
      if (toDateKey(parseDateOnly(event.date)) !== dateKey || event.allDay || event.startMin === null || event.endMin === null) return false;
      return overlaps(startMin, endMin, event.startMin, event.endMin);
    });
    if (eventConflict) continue;

    const blockConflict = blocks.some((block) => {
      const occurrence = blockOccurrenceOn(block, date, exceptions);
      return occurrence !== null && overlaps(startMin, endMin, occurrence.startMin, occurrence.endMin);
    });
    if (!blockConflict) return startMin;
  }

  return null;
}
