import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import { blockOccurrenceOn } from "./timeblocks.util";

const date = DateTime.fromISO("2026-09-03", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
const block = {
  id: "block-under-test",
  startMin: 540,
  endMin: 600,
  createdAt: date,
  daysOfWeek: [4],
  repeatEveryWeeks: 1,
  repeatEndsAt: null,
};

describe("block occurrences", () => {
  test("returns the weekly occurrence", () => {
    expect(blockOccurrenceOn(block, date)).toEqual({
      occurs: true,
      startMin: 540,
      endMin: 600,
      exceptionId: null,
    });
  });

  test("applies skip and move exceptions for the selected day", () => {
    expect(blockOccurrenceOn(block, date, [{
      id: "skip",
      blockId: block.id,
      action: "skip",
      startMin: null,
      endMin: null,
      date,
    }])).toEqual({ occurs: false });

    expect(blockOccurrenceOn(block, date, [{
      id: "move",
      blockId: block.id,
      action: "move",
      startMin: 660,
      endMin: 720,
      date,
    }])).toEqual({
      occurs: true,
      startMin: 660,
      endMin: 720,
      exceptionId: "move",
    });
  });

  test("moves a block occurrence to a different day", () => {
    const targetDate = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ days: 1 }).startOf("day").toJSDate();
    const exception = {
      id: "move-to-target",
      blockId: block.id,
      action: "move",
      startMin: 600,
      endMin: 660,
      date,
      targetDate,
    };

    expect(blockOccurrenceOn(block, date, [exception])).toEqual({ occurs: false });
    expect(blockOccurrenceOn(block, targetDate, [exception])).toEqual({
      occurs: true,
      startMin: 600,
      endMin: 660,
      exceptionId: "move-to-target",
    });
  });

  test("does not occur on a day outside the weekly pattern", () => {
    const nextDay = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ days: 1 }).toJSDate();
    expect(blockOccurrenceOn(block, nextDay)).toEqual({ occurs: false });
  });

  test("supports a one-off block on its selected date", () => {
    const oneOff = { ...block, date };
    const nextWeek = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ weeks: 1 }).toJSDate();

    expect(blockOccurrenceOn(oneOff, date)).toEqual({
      occurs: true,
      startMin: 540,
      endMin: 600,
      exceptionId: null,
    });
    expect(blockOccurrenceOn(oneOff, nextWeek)).toEqual({ occurs: false });
  });

  test("does not show a future series before its effective start", () => {
    const effectiveStart = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ weeks: 1 }).toJSDate();
    const futureBlock = { ...block, recurrenceStartsAt: effectiveStart };

    expect(blockOccurrenceOn(futureBlock, date)).toEqual({ occurs: false });
    expect(blockOccurrenceOn(futureBlock, effectiveStart)).toEqual({
      occurs: true,
      startMin: 540,
      endMin: 600,
      exceptionId: null,
    });
  });

  test("stops a series on the exact end date instead of the end week", () => {
    const endDate = DateTime.fromISO("2026-09-09", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
    const nextOccurrence = DateTime.fromISO("2026-09-10", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
    const endingBlock = {
      ...block,
      createdAt: DateTime.fromISO("2026-09-07", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
      daysOfWeek: [1, 4],
      repeatEndsAt: endDate,
    };

    expect(blockOccurrenceOn(endingBlock, endDate)).toEqual({ occurs: false });
    expect(blockOccurrenceOn(endingBlock, nextOccurrence)).toEqual({ occurs: false });
  });
});
