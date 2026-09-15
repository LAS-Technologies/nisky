import { DateTime } from "luxon";
import { describe, expect, mock, test } from "bun:test";
import type { CalendarEvent } from "../../infra/prisma/generated/prisma/client";

const eventDate = DateTime.fromISO("2026-09-14", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
const allDayEvent = {
  id: "all-day-event",
  userId: "user-under-test",
  title: "Día completo",
  date: eventDate,
  recurrenceStartsAt: null,
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

const recurringEvent = {
  ...allDayEvent,
  id: "recurring-event",
  allDay: false,
  startMin: 540,
  endMin: 600,
  recurrenceType: "WEEKLY",
  recurrenceDaysOfWeek: [1],
} as CalendarEvent;
const calendarEventFindMany = mock(async () => [allDayEvent]);
const calendarEventFindFirst = mock(async ({ where }: { where: { id: string } }) =>
  where.id === "recurring-event" ? recurringEvent : allDayEvent,
);
const calendarEventCreate = mock(async ({ data }: { data: Record<string, unknown> }) => ({ id: "created-event", ...data }));
const calendarEventUpdate = mock(async ({ data }: { data: unknown }) => data);
const eventExceptionFindMany = mock(async () => []);
const eventExceptionUpdateMany = mock(async () => ({ count: 0 }));
const eventExceptionUpsert = mock(async ({ create }: { create: Record<string, unknown> }) => create);
const eventExceptionCreate = mock(async ({ data }: { data: Record<string, unknown> }) => data);
const blockExceptionFindMany = mock(async () => []);
const blockFindMany = mock(async () => []);
const transaction = mock(async (callback: (tx: unknown) => Promise<unknown>) => callback({
  calendarEvent: { create: calendarEventCreate, update: calendarEventUpdate },
  calendarEventException: {
    findMany: eventExceptionFindMany,
    updateMany: eventExceptionUpdateMany,
    upsert: eventExceptionUpsert,
    create: eventExceptionCreate,
  },
}));

mock.module("../../infra/prisma/client", () => ({
  prisma: {
    calendarEvent: {
      findFirst: calendarEventFindFirst,
      findMany: calendarEventFindMany,
      create: calendarEventCreate,
      update: calendarEventUpdate,
    },
    calendarEventException: {
      findMany: eventExceptionFindMany,
      updateMany: eventExceptionUpdateMany,
      upsert: eventExceptionUpsert,
      create: eventExceptionCreate,
    },
    timeBlockException: {
      findMany: blockExceptionFindMany,
    },
    timeBlock: {
      findMany: blockFindMany,
    },
    $transaction: transaction,
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

  test("keeps the historical series when changing from a future date", async () => {
    calendarEventCreate.mockClear();
    calendarEventUpdate.mockClear();
    eventExceptionUpdateMany.mockClear();

    const updated = await new EventsService().update("user-under-test", "recurring-event", {
      effectiveFrom: "2026-09-21",
      startMin: 600,
      endMin: 660,
    });

    const oldEnd = calendarEventUpdate.mock.calls[0]?.[0] as { data: { recurrenceEndsAt: Date } };
    const created = calendarEventCreate.mock.calls[0]?.[0] as { data: { date: Date; startMin: number; endMin: number } };
    expect(DateTime.fromJSDate(oldEnd.data.recurrenceEndsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
    expect(DateTime.fromJSDate(created.data.date, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-21");
    expect(created.data.startMin).toBe(600);
    expect(created.data.endMin).toBe(660);
    expect(eventExceptionUpdateMany).toHaveBeenCalledWith({
      where: { eventId: "recurring-event", date: { gte: expect.any(Date) } },
      data: { eventId: "created-event" },
    });
    expect(updated).toMatchObject({ id: "created-event", startMin: 600, endMin: 660 });
  });

  test("keeps a backward move after the historical cutoff", async () => {
    calendarEventCreate.mockClear();
    calendarEventUpdate.mockClear();
    eventExceptionUpdateMany.mockClear();
    eventExceptionUpsert.mockClear();

    await new EventsService().update("user-under-test", "recurring-event", {
      effectiveFrom: "2026-09-21",
      date: "2026-09-20",
    });

    const created = calendarEventCreate.mock.calls[0]?.[0] as { data: { date: Date; recurrenceStartsAt: Date } };
    expect(DateTime.fromJSDate(created.data.date, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
    expect(DateTime.fromJSDate(created.data.recurrenceStartsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-21");
    expect(eventExceptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ targetDate: expect.any(Date) }),
    }));
  });
});
