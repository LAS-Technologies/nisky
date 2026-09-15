import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import {
  calendarDateKey,
  calendarDateToDate,
  isCalendarDate,
  nextCalendarDayStart,
  parseCalendarDate,
} from "./calendar-date";

const zone = "America/Santo_Domingo";

describe("calendar dates", () => {
  test("accepts valid dates and rejects timestamps or impossible days", () => {
    expect(isCalendarDate("2026-09-20")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-09-20T00:00:00.000Z")).toBe(false);
  });

  test("stores a date-only value at local midnight", () => {
    const value = calendarDateToDate("2026-09-20");

    expect(DateTime.fromJSDate(value, { zone }).toISO()).toBe("2026-09-20T00:00:00.000-04:00");
    expect(calendarDateKey(value, zone)).toBe("2026-09-20");
  });

  test("uses the following local day for inclusive range upper bounds", () => {
    const end = calendarDateToDate("2026-09-20");

    expect(DateTime.fromJSDate(nextCalendarDayStart(end), { zone }).toISODate()).toBe("2026-09-21");
  });

  test("throws for an invalid calendar date", () => {
    expect(() => parseCalendarDate("2026-02-29")).toThrow(RangeError);
  });
});
