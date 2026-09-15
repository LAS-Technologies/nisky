import { describe, expect, test } from "bun:test";
import { createTimeBlockExceptionSchema } from "./timeblocks.validator";

describe("time block exception validator", () => {
  test("accepts a move to a different date", () => {
    const result = createTimeBlockExceptionSchema.safeParse({
      date: "2026-09-03",
      targetDate: "2026-09-04",
      action: "move",
      startMin: 600,
      endMin: 660,
    });

    expect(result.success).toBe(true);
  });

  test("does not allow a target date for a skipped occurrence", () => {
    const result = createTimeBlockExceptionSchema.safeParse({
      date: "2026-09-03",
      targetDate: "2026-09-04",
      action: "skip",
    });

    expect(result.success).toBe(false);
  });
});
