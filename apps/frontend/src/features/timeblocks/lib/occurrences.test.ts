import { describe, expect, test } from "bun:test";
import type { TimeBlock, TimeBlockException } from "@/types/entities";
import { parseDateOnly } from "./time";
import { blockOccurrenceOn } from "./occurrences";

const block = {
  id: "block-under-test",
  userId: "user-under-test",
  projectId: null,
  date: null,
  recurrenceStartsAt: "2026-09-07T00:00:00",
  name: "Estudio",
  daysOfWeek: [1, 4],
  startMin: 540,
  endMin: 600,
  isActive: true,
  repeatEveryWeeks: 2,
  repeatEndsAt: null,
  remindBeforeMin: 0,
  lastRemindNotifiedAt: null,
  lastStartNotifiedAt: null,
  lastEndWarnNotifiedAt: null,
  createdAt: "2026-09-01T00:00:00",
  updatedAt: "2026-09-01T00:00:00",
} as TimeBlock;

function date(value: string) {
  return parseDateOnly(value);
}

function exception(overrides: Partial<TimeBlockException>): TimeBlockException {
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

describe("time block occurrences", () => {
  test("uses the recurrence anchor and calendar-week interval", () => {
    expect(blockOccurrenceOn(block, date("2026-09-07"))).toMatchObject({ startMin: 540, endMin: 600 });
    expect(blockOccurrenceOn(block, date("2026-09-10"))).not.toBeNull();
    expect(blockOccurrenceOn(block, date("2026-09-14"))).toBeNull();
    expect(blockOccurrenceOn(block, date("2026-09-09"))).toBeNull();
    expect(blockOccurrenceOn(block, date("2026-09-21"))).not.toBeNull();
  });

  test("applies skip and moved exceptions consistently", () => {
    expect(blockOccurrenceOn(block, date("2026-09-14"), [exception({ action: "skip" })])).toBeNull();

    const moved = exception({
      action: "move",
      targetDate: "2026-09-15",
      startMin: 660,
      endMin: 720,
    });
    expect(blockOccurrenceOn(block, date("2026-09-14"), [moved])).toBeNull();
    expect(blockOccurrenceOn(block, date("2026-09-15"), [moved])).toMatchObject({
      startMin: 660,
      endMin: 720,
      exception: moved,
    });
  });

  test("supports a one-off block only on its date", () => {
    const oneOff = { ...block, date: "2026-09-14", recurrenceStartsAt: null };

    expect(blockOccurrenceOn(oneOff, date("2026-09-14"))).not.toBeNull();
    expect(blockOccurrenceOn(oneOff, date("2026-09-21"))).toBeNull();
  });

  test("uses the calendar day of a legacy creation instant", () => {
    const legacy = {
      ...block,
      recurrenceStartsAt: null,
      createdAt: "2026-09-15T03:30:00.000Z",
      daysOfWeek: [1],
    };

    expect(blockOccurrenceOn(legacy, date("2026-09-14"))).not.toBeNull();
    expect(blockOccurrenceOn(legacy, date("2026-09-15"))).toBeNull();
  });

  test("stops on the exact repeat end date", () => {
    const ending = { ...block, repeatEveryWeeks: 1, repeatEndsAt: "2026-09-14" };

    expect(blockOccurrenceOn(ending, date("2026-09-14"))).not.toBeNull();
    expect(blockOccurrenceOn(ending, date("2026-09-15"))).toBeNull();
  });
});
