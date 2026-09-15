import { describe, expect, test } from "bun:test";
import type { CalendarEvent, TimeBlock, TimeBlockException } from "@/types/entities";
import { findAvailableStartMin } from "./availability";

const block = {
  id: "block-under-test",
  userId: "user-under-test",
  projectId: null,
  date: null,
  recurrenceStartsAt: "2026-09-07T00:00:00",
  name: "Estudio",
  daysOfWeek: [1],
  startMin: 540,
  endMin: 600,
  isActive: true,
  repeatEveryWeeks: 1,
  repeatEndsAt: null,
  remindBeforeMin: 0,
  lastRemindNotifiedAt: null,
  lastStartNotifiedAt: null,
  lastEndWarnNotifiedAt: null,
  createdAt: "2026-09-01T00:00:00",
  updatedAt: "2026-09-01T00:00:00",
} as TimeBlock;

const timedEvent = {
  date: "2026-09-14",
  allDay: false,
  startMin: 540,
  endMin: 600,
} satisfies Pick<CalendarEvent, "date" | "allDay" | "startMin" | "endMin">;

function blockException(overrides: Partial<TimeBlockException>): TimeBlockException {
  return {
    id: "exception-under-test",
    blockId: block.id,
    userId: block.userId,
    date: "2026-09-14",
    targetDate: null,
    action: "skip",
    startMin: null,
    endMin: null,
    createdAt: "2026-09-01T00:00:00",
    updatedAt: "2026-09-01T00:00:00",
    ...overrides,
  };
}

describe("calendar availability", () => {
  test("finds the next quarter-hour after a recurring block and event", () => {
    expect(findAvailableStartMin({
      blocks: [block],
      dateKey: "2026-09-14",
      durationMin: 60,
      events: [timedEvent],
      preferredStartMin: 540,
    })).toBe(600);
  });

  test("respects skip and move exceptions for blocks", () => {
    const skip = blockException({ action: "skip" });
    expect(findAvailableStartMin({
      blocks: [block],
      dateKey: "2026-09-14",
      events: [],
      exceptions: [skip],
      preferredStartMin: 540,
    })).toBe(540);

    const move = blockException({
      action: "move",
      date: "2026-09-07",
      targetDate: "2026-09-14",
      startMin: 540,
      endMin: 600,
    });
    expect(findAvailableStartMin({
      blocks: [block],
      dateKey: "2026-09-14",
      events: [],
      exceptions: [move],
      preferredStartMin: 540,
    })).toBe(600);
  });
});
