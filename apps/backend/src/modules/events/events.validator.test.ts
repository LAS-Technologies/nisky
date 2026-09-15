import { describe, expect, test } from "bun:test";
import { createEventExceptionSchema, updateEventSchema } from "./events.validator";

describe("event update validator", () => {
  test("keeps reminder updates partial", () => {
    expect(updateEventSchema.parse({ remindBeforeMin: 15 })).toEqual({ remindBeforeMin: 15 });
  });

  test("does not reset recurrence fields when updating the reminder", () => {
    expect(updateEventSchema.parse({ remindBeforeMin: 30 })).not.toHaveProperty("recurrenceDaysOfWeek");
    expect(updateEventSchema.parse({ remindBeforeMin: 30 })).not.toHaveProperty("recurrenceInterval");
  });

  test("does not reset the reminder when updating recurrence", () => {
    expect(
      updateEventSchema.parse({
        recurrenceDaysOfWeek: [1],
        recurrenceType: "WEEKLY",
      }),
    ).toEqual({
      recurrenceDaysOfWeek: [1],
      recurrenceType: "WEEKLY",
    });
  });

  test("accepts a target date when moving an occurrence", () => {
    expect(createEventExceptionSchema.parse({
      date: "2026-09-14",
      targetDate: "2026-09-15",
      action: "move",
      startMin: 540,
      endMin: 600,
    })).toMatchObject({ targetDate: "2026-09-15", action: "move" });
  });
});
