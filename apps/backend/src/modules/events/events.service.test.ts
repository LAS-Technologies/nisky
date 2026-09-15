import { DateTime } from "luxon";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { CalendarEvent, CalendarEventException } from "../../infra/prisma/generated/prisma/client";

const eventDate = DateTime.fromISO("2026-09-14", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
function calendarDate(value: string) {
  return DateTime.fromISO(value, { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
}
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
type CalendarEventRow = CalendarEvent & { exceptions?: CalendarEventException[] };
let recurringExceptions: CalendarEventException[] = [];
let calendarEventRows: CalendarEventRow[] = [allDayEvent];
let blockRows: CalendarEvent[] = [];
const calendarEventFindMany = mock(async ({ where }: { where?: { id?: { not?: string } } } = {}) =>
  calendarEventRows.filter((event) => !where?.id?.not || event.id !== where.id.not),
);
const calendarEventFindFirst = mock(async ({ where }: { where: { id: string } }) => {
  if (where.id === "recurring-event") return { ...recurringEvent, exceptions: recurringExceptions };
  return allDayEvent;
});
const calendarEventCreate = mock(async ({ data }: { data: Record<string, unknown> }) => ({ id: "created-event", ...data }));
const calendarEventUpdate = mock(async ({ data }: { data: unknown }) => data);
const eventExceptionFindMany = mock(async () => []);
const eventExceptionUpdateMany = mock(async () => ({ count: 0 }));
const eventExceptionUpsert = mock(async ({ create }: { create: Record<string, unknown> }) => create);
const eventExceptionCreate = mock(async ({ data }: { data: Record<string, unknown> }) => data);
const blockExceptionFindMany = mock(async () => []);
const blockFindMany = mock(async () => blockRows);
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

beforeEach(() => {
  recurringExceptions = [];
  calendarEventRows = [allDayEvent];
  blockRows = [];
  calendarEventCreate.mockClear();
  calendarEventUpdate.mockClear();
  calendarEventFindMany.mockClear();
  eventExceptionUpsert.mockClear();
  eventExceptionUpdateMany.mockClear();
});

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

  test("anchors a new recurring event on its local start date", async () => {
    await new EventsService().create("user-under-test", {
      title: "Evento semanal",
      date: "2026-09-20",
      allDay: false,
      startMin: 540,
      endMin: 600,
      recurrenceType: "WEEKLY",
      recurrenceInterval: 1,
      recurrenceDaysOfWeek: [0],
      recurrenceDayOfMonth: null,
      recurrenceEndsAt: "2026-09-27",
      remindBeforeMin: 0,
    });

    const created = calendarEventCreate.mock.calls[0]?.[0] as { data: { date: Date; recurrenceStartsAt: Date; recurrenceEndsAt: Date } };
    expect(DateTime.fromJSDate(created.data.date, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
    expect(DateTime.fromJSDate(created.data.recurrenceStartsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
    expect(DateTime.fromJSDate(created.data.recurrenceEndsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-27");
  });

  test("updates the recurrence anchor when changing an event's base date", async () => {
    await new EventsService().update("user-under-test", "recurring-event", {
      date: "2026-09-20",
    });

    const updated = calendarEventUpdate.mock.calls[0]?.[0] as { data: { date: Date; recurrenceStartsAt: Date } };
    expect(DateTime.fromJSDate(updated.data.date, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
    expect(DateTime.fromJSDate(updated.data.recurrenceStartsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
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

  test("rejects an exception whose source date has no real occurrence", async () => {
    await expect(new EventsService().createException("user-under-test", "recurring-event", {
      date: "2026-09-15",
      action: "skip",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(eventExceptionUpsert).not.toHaveBeenCalled();
  });

  test("preserves the original hours when moving a timed event without new hours", async () => {
    await new EventsService().createException("user-under-test", "recurring-event", {
      date: "2026-09-14",
      targetDate: "2026-09-15",
      action: "move",
    });

    expect(eventExceptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ startMin: 540, endMin: 600 }),
    }));
  });

  test("rejects moving onto another occurrence of the same series", async () => {
    await expect(new EventsService().createException("user-under-test", "recurring-event", {
      date: "2026-09-14",
      targetDate: "2026-09-21",
      action: "move",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(eventExceptionUpsert).not.toHaveBeenCalled();
  });

  test("rejects a target date already used by another move exception", async () => {
    recurringExceptions = [{
      id: "existing-move",
      userId: "user-under-test",
      eventId: "recurring-event",
      date: calendarDate("2026-09-07"),
      targetDate: calendarDate("2026-09-15"),
      action: "move",
      startMin: 540,
      endMin: 600,
      createdAt: eventDate,
      updatedAt: eventDate,
    }];

    await expect(new EventsService().createException("user-under-test", "recurring-event", {
      date: "2026-09-21",
      targetDate: "2026-09-15",
      action: "move",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(eventExceptionUpsert).not.toHaveBeenCalled();
  });

  test("reports a conflict at the destination of a moved occurrence", async () => {
    calendarEventRows = [{
      ...recurringEvent,
      id: "destination-conflict",
      title: "Otra clase",
      date: calendarDate("2026-09-15"),
      recurrenceStartsAt: null,
      recurrenceType: null,
      recurrenceDaysOfWeek: [],
      exceptions: [],
    }];

    await expect(new EventsService().createException("user-under-test", "recurring-event", {
      date: "2026-09-14",
      targetDate: "2026-09-15",
      action: "move",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      details: expect.objectContaining({ id: "destination-conflict", date: "2026-09-15" }),
    });
  });
});
