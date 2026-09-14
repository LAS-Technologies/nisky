import { DateTime } from "luxon";
import { describe, expect, mock, test } from "bun:test";
import type { CalendarEvent } from "../../infra/prisma/generated/prisma/client";

const eventDate = DateTime.fromISO("2026-09-14", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
const allDayEvent = {
  id: "all-day-event",
  userId: "user-under-test",
  title: "Día completo",
  date: eventDate,
  allDay: true,
  startMin: 0,
  endMin: 1440,
  location: null,
  color: null,
  recurrenceType: null,
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [],
  recurrenceDayOfMonth: null,
  recurrenceEndsAt: null,
  remindBeforeMin: 0,
  lastRemindNotifiedAt: null,
  lastStartNotifiedAt: null,
  lastEndWarnNotifiedAt: null,
  createdAt: eventDate,
  updatedAt: eventDate,
  exceptions: [],
} as CalendarEvent & { exceptions: [] };

const calendarEventFindMany = mock(async () => [allDayEvent]);
const calendarEventCreate = mock(async ({ data }: { data: unknown }) => data);
const eventExceptionFindMany = mock(async () => []);
const blockExceptionFindMany = mock(async () => []);
const blockFindMany = mock(async () => []);

mock.module("../../infra/prisma/client", () => ({
  prisma: {
    calendarEvent: {
      findMany: calendarEventFindMany,
      create: calendarEventCreate,
    },
    calendarEventException: {
      findMany: eventExceptionFindMany,
    },
    timeBlockException: {
      findMany: blockExceptionFindMany,
    },
    timeBlock: {
      findMany: blockFindMany,
    },
  },
}));

const { EventsService } = await import("./events.service");

describe("EventsService.create", () => {
  test("allows a timed event on a day with an all-day event", async () => {
    await expect(
      new EventsService().create("user-under-test", {
        title: "Evento horario",
        date: "2026-09-14",
        allDay: false,
        startMin: 540,
        endMin: 600,
        recurrenceType: null,
        recurrenceInterval: 1,
        recurrenceDaysOfWeek: [],
        recurrenceDayOfMonth: null,
        recurrenceEndsAt: null,
        remindBeforeMin: 0,
      }),
    ).resolves.toBeDefined();

    expect(calendarEventCreate).toHaveBeenCalled();
  });
});
