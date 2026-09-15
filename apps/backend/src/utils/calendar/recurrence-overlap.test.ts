import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";
import { findCalendarConflict, type EventSeries, type TimeBlockSeries } from "./recurrence-overlap";

const zone = "America/Santo_Domingo";

function date(value: string) {
  return DateTime.fromISO(value, { zone }).startOf("day").toJSDate();
}

function blockSeries(overrides: Partial<TimeBlockSeries["block"]> = {}): TimeBlockSeries {
  const createdAt = date("2026-09-14");
  const id = overrides.id ?? "block";
  return {
    kind: "TIME_BLOCK",
    id,
    label: "Bloque",
    block: {
      id,
      date: null,
      recurrenceStartsAt: createdAt,
      startMin: 540,
      endMin: 600,
      createdAt,
      daysOfWeek: [1],
      repeatEveryWeeks: 1,
      repeatEndsAt: null,
      ...overrides,
    },
    exceptions: [],
  };
}

function eventSeries(overrides: Partial<CalendarEvent> = {}, exceptions: CalendarEventException[] = []): EventSeries {
  const eventDate = date("2026-09-14");
  const event = {
    id: "event",
    userId: "user",
    title: "Evento",
    date: eventDate,
    recurrenceStartsAt: eventDate,
    allDay: false,
    startMin: 540,
    endMin: 600,
    location: null,
    color: null,
    recurrenceType: "WEEKLY",
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: [1],
    recurrenceDayOfMonth: null,
    recurrenceEndsAt: null,
    remindBeforeMin: 0,
    lastRemindNotifiedAt: null,
    lastStartNotifiedAt: null,
    lastEndWarnNotifiedAt: null,
    createdAt: eventDate,
    updatedAt: eventDate,
    ...overrides,
  } as CalendarEvent;
  return { kind: "EVENT", id: event.id, label: event.title, event, exceptions };
}

describe("recurrence overlap", () => {
  test("ignores a one-off block before the candidate series starts", () => {
    const candidate = blockSeries({ id: "candidate", daysOfWeek: [1] });
    const historical = blockSeries({
      id: "historical",
      date: date("2026-09-13"),
      recurrenceStartsAt: null,
      createdAt: date("2026-09-01"),
    });

    expect(findCalendarConflict(candidate, [historical])).toBeNull();
  });

  test("returns the first real occurrence of an active overlapping block", () => {
    const candidate = blockSeries({ id: "candidate", daysOfWeek: [1, 2] });
    const existing = blockSeries({ id: "existing" });

    expect(findCalendarConflict(candidate, [existing])).toMatchObject({
      kind: "TIME_BLOCK",
      id: "existing",
      date: "2026-09-14",
      startMin: 540,
      endMin: 600,
      source: "base",
    });
  });

  test("uses configured weekly event days instead of the event base day", () => {
    const candidate = blockSeries({ id: "candidate", daysOfWeek: [3] });
    const existing = eventSeries({ recurrenceDaysOfWeek: [3] });

    expect(findCalendarConflict(candidate, [existing])).toMatchObject({
      kind: "EVENT",
      id: "event",
      date: "2026-09-16",
    });
  });

  test("does not treat a skipped occurrence as a conflict", () => {
    const candidate = blockSeries({ id: "candidate", date: date("2026-09-14") });
    const existing = eventSeries({}, [{
      id: "skip",
      userId: "user",
      eventId: "event",
      date: date("2026-09-14"),
      targetDate: null,
      action: "skip",
      startMin: null,
      endMin: null,
      createdAt: date("2026-09-01"),
      updatedAt: date("2026-09-01"),
    }]);

    expect(findCalendarConflict(candidate, [existing])).toBeNull();
  });

  test("checks a moved occurrence at its destination", () => {
    const targetDate = date("2026-09-15");
    const candidate = blockSeries({ id: "candidate", date: targetDate, daysOfWeek: [2] });
    const existing = eventSeries({}, [{
      id: "move",
      userId: "user",
      eventId: "event",
      date: date("2026-09-14"),
      targetDate,
      action: "move",
      startMin: 540,
      endMin: 600,
      createdAt: date("2026-09-01"),
      updatedAt: date("2026-09-01"),
    }]);

    expect(findCalendarConflict(candidate, [existing])).toMatchObject({
      kind: "EVENT",
      id: "event",
      date: "2026-09-15",
      source: "exception",
    });
  });

  test("does not conflict with an all-day event", () => {
    const candidate = blockSeries({ id: "candidate", date: date("2026-09-14") });
    const existing = eventSeries({ allDay: true, startMin: 0, endMin: 1440 });

    expect(findCalendarConflict(candidate, [existing])).toBeNull();
  });
});
