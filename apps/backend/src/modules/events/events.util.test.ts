import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";
import { eventOccurrenceOn, expandEventOccurrences, parseEventDate } from "./events.util";

const date = DateTime.fromISO("2026-09-03", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
const event = {
  id: "event-under-test",
  userId: "user-under-test",
  title: "Evento semanal",
  date,
  recurrenceStartsAt: null,
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

  test("moves a recurring occurrence to its target date", () => {
    const targetDate = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ days: 1 }).startOf("day").toJSDate();
    const exception = {
      id: "exception-under-test",
      userId: "user-under-test",
      eventId: event.id,
      date,
      targetDate,
      action: "move",
      startMin: 600,
      endMin: 660,
      createdAt: date,
      updatedAt: date,
    } as CalendarEventException;

    expect(eventOccurrenceOn(event, date, [exception]).occurs).toBe(false);
    expect(eventOccurrenceOn(event, targetDate, [exception])).toMatchObject({
      occurs: true,
      startMin: 600,
      endMin: 660,
      isException: true,
    });
    expect(expandEventOccurrences(event, targetDate, targetDate, [exception])).toEqual([
      expect.objectContaining({
        date: targetDate,
        startMin: 600,
        endMin: 660,
        isException: true,
      }),
    ]);
  });

  test("stops the historical series before a future change", () => {
    const endDate = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ days: 6 }).startOf("day").toJSDate();
    const closedEvent = { ...event, recurrenceEndsAt: endDate };
    const nextOccurrence = DateTime.fromJSDate(date, { zone: "America/Santo_Domingo" }).plus({ days: 7 }).toJSDate();

    expect(eventOccurrenceOn(closedEvent, date).occurs).toBe(true);
    expect(eventOccurrenceOn(closedEvent, nextOccurrence).occurs).toBe(false);
  });

  test("does not show a future series before its effective start", () => {
    const effectiveStart = DateTime.fromISO("2026-09-07", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
    const futureEvent = {
      ...event,
      date: DateTime.fromISO("2026-09-03", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
      recurrenceDaysOfWeek: [1],
      recurrenceStartsAt: effectiveStart,
    };

    expect(eventOccurrenceOn(futureEvent, date).occurs).toBe(false);
    expect(eventOccurrenceOn(futureEvent, effectiveStart).occurs).toBe(true);
  });

  test("measures weekly intervals from calendar weeks", () => {
    const biweekly = {
      ...event,
      recurrenceInterval: 2,
      recurrenceDaysOfWeek: [1, 4],
    };
    const followingMonday = DateTime.fromISO("2026-09-07", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();

    expect(eventOccurrenceOn(biweekly, followingMonday).occurs).toBe(false);
  });

  test("does not let another event's exception enter the requested range", () => {
    const foreignException = {
      id: "foreign-exception",
      userId: "user-under-test",
      eventId: "another-event",
      date: date,
      targetDate: DateTime.fromISO("2026-09-04", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
      action: "move",
      startMin: 660,
      endMin: 720,
      createdAt: date,
      updatedAt: date,
    } as CalendarEventException;

    expect(expandEventOccurrences(
      { ...event, recurrenceType: null },
      DateTime.fromISO("2026-09-04", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
      DateTime.fromISO("2026-09-04", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
      [foreignException],
    )).toEqual([]);
  });

  test("does not expand a one-off event onto the following day", () => {
    const oneOff = { ...event, recurrenceType: null };
    const nextDay = DateTime.fromISO("2026-09-04", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();

    expect(expandEventOccurrences(oneOff, date, nextDay)).toEqual([
      expect.objectContaining({ date }),
    ]);
  });
});
