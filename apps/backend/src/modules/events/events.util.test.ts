import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import type { CalendarEvent } from "../../infra/prisma/generated/prisma/client";
import { eventOccurrenceOn, parseEventDate } from "./events.util";

const date = DateTime.fromISO("2026-09-03", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
const event = {
  id: "event-under-test",
  userId: "user-under-test",
  title: "Evento semanal",
  date,
  allDay: false,
  startMin: 540,
  endMin: 600,
  location: null,
  color: null,
  recurrenceType: "WEEKLY",
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [],
  recurrenceDayOfMonth: null,
  recurrenceEndsAt: null,
  remindBeforeMin: 15,
  lastRemindNotifiedAt: null,
  lastStartNotifiedAt: null,
  lastEndWarnNotifiedAt: null,
  createdAt: date,
  updatedAt: date,
  exceptions: [],
} as CalendarEvent;

describe("event occurrences", () => {
  test("keeps a Sunday date on Sunday when parsing a date-only query value", () => {
    const parsed = parseEventDate("2026-09-20");

    expect(DateTime.fromJSDate(parsed, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
  });

  test("recovers a weekly event without saved days on its base weekday", () => {
    expect(eventOccurrenceOn(event, date).occurs).toBe(true);
    expect(eventOccurrenceOn(event, DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ days: 1 }).toJSDate()).occurs).toBe(false);
  });
});
