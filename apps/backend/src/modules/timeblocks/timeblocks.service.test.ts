import { DateTime } from "luxon";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import type { TimeBlock, TimeBlockException } from "../../infra/prisma/generated/prisma/client";

const createdAt = DateTime.fromISO("2026-09-03", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
function calendarDate(value: string) {
  return DateTime.fromISO(value, { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
}
const currentBlock = {
  id: "block-under-test",
  userId: "user-under-test",
  projectId: null,
  date: null,
  recurrenceStartsAt: null,
  name: "Gimnasio",
  daysOfWeek: [4],
  startMin: 540,
  endMin: 600,
  isActive: true,
  repeatEveryWeeks: 1,
  repeatEndsAt: null,
  remindBeforeMin: 0,
  lastRemindNotifiedAt: null,
  lastStartNotifiedAt: null,
  lastEndWarnNotifiedAt: null,
  createdAt,
  updatedAt: createdAt,
} as TimeBlock;

const historicalEnd = DateTime.fromISO("2026-09-20", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
const historicalBlock = {
  ...currentBlock,
  id: "historical-block",
  startMin: 550,
  endMin: 610,
  repeatEndsAt: historicalEnd,
} as TimeBlock;
const oneOffBlock = {
  ...currentBlock,
  id: "one-off-block",
  date: DateTime.fromISO("2026-09-14", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
  recurrenceStartsAt: null,
  daysOfWeek: [1],
} as TimeBlock;
let blockExceptions: TimeBlockException[] = [];
const historicalEvent = {
  date: DateTime.fromISO("2026-09-17", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
  allDay: false,
  startMin: 550,
  endMin: 610,
  recurrenceType: "WEEKLY",
  recurrenceEndsAt: historicalEnd,
};
const timeBlockFindFirst = mock(async ({ where }: { where: Record<string, unknown> }) => {
  if (where.id === currentBlock.id) return { ...currentBlock, exceptions: blockExceptions };
  if (where.id === oneOffBlock.id) return oneOffBlock;
  if (where.daysOfWeek && !where.OR) return historicalBlock;
  return null;
});
let timeBlockRows: TimeBlock[] = [];
const timeBlockFindMany = mock(async () => timeBlockRows);
const timeBlockUpdate = mock(async ({ data }: { data: unknown }) => data);
const timeBlockCreate = mock(async ({ data }: { data: Record<string, unknown> }) => ({ id: "future-block", ...data }));
const timeBlockExceptionFindMany = mock(async () => []);
const timeBlockExceptionDeleteMany = mock(async () => ({ count: 0 }));
const timeBlockExceptionUpdateMany = mock(async () => ({ count: 0 }));
const timeBlockExceptionCreate = mock(async ({ data }: { data: Record<string, unknown> }) => data);
const timeBlockExceptionUpsert = mock(async ({ create }: { create: Record<string, unknown> }) => create);
const taskScheduleUpdateMany = mock(async () => ({ count: 0 }));
let calendarEventRows: Array<Record<string, unknown>> = [historicalEvent];
const calendarEventFindMany = mock(async ({ where }: { where?: { OR?: unknown } } = {}) => where?.OR ? [] : calendarEventRows);
const transaction = mock(async (callback: (tx: unknown) => Promise<unknown>) => callback({
  timeBlock: { create: timeBlockCreate, update: timeBlockUpdate },
  timeBlockException: {
    findMany: timeBlockExceptionFindMany,
    deleteMany: timeBlockExceptionDeleteMany,
    updateMany: timeBlockExceptionUpdateMany,
    create: timeBlockExceptionCreate,
    upsert: timeBlockExceptionUpsert,
  },
  taskSchedule: { updateMany: taskScheduleUpdateMany },
}));

mock.module("../../infra/prisma/client", () => ({
  prisma: {
    project: { findFirst: mock(async () => null) },
    timeBlock: { findFirst: timeBlockFindFirst, findMany: timeBlockFindMany, create: timeBlockCreate, update: timeBlockUpdate },
    timeBlockException: {
      findMany: timeBlockExceptionFindMany,
      deleteMany: timeBlockExceptionDeleteMany,
      upsert: timeBlockExceptionUpsert,
    },
    calendarEvent: { findMany: calendarEventFindMany },
    $transaction: transaction,
  },
}));

const { TimeBlockService } = await import("./timeblocks.service");

describe("TimeBlockService.update", () => {
  beforeEach(() => {
    blockExceptions = [];
    timeBlockRows = [];
    calendarEventRows = [historicalEvent];
    timeBlockCreate.mockClear();
    timeBlockFindFirst.mockClear();
    timeBlockFindMany.mockClear();
    timeBlockUpdate.mockClear();
    timeBlockExceptionUpsert.mockClear();
    calendarEventFindMany.mockClear();
  });

  test("splits a recurring block without changing its historical series", async () => {
    timeBlockCreate.mockClear();
    timeBlockFindFirst.mockClear();
    timeBlockFindMany.mockClear();
    timeBlockUpdate.mockClear();
    timeBlockExceptionUpdateMany.mockClear();
    taskScheduleUpdateMany.mockClear();
    calendarEventFindMany.mockClear();

    const updated = await new TimeBlockService().update("user-under-test", currentBlock.id, {
      effectiveFrom: "2026-09-21",
      startMin: 600,
      endMin: 660,
    });

    const oldEnd = timeBlockUpdate.mock.calls[0]?.[0] as { data: { repeatEndsAt: Date } };
    const created = timeBlockCreate.mock.calls[0]?.[0] as { data: { recurrenceStartsAt: Date; startMin: number; endMin: number } };
    expect(DateTime.fromJSDate(oldEnd.data.repeatEndsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-20");
    expect(DateTime.fromJSDate(created.data.recurrenceStartsAt, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-21");
    expect(created.data.startMin).toBe(600);
    expect(created.data.endMin).toBe(660);
    expect(timeBlockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-under-test", id: { not: currentBlock.id } },
      include: expect.objectContaining({ exceptions: true }),
    }));
    expect(calendarEventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-under-test" },
      include: expect.objectContaining({ exceptions: true }),
    }));
    expect(timeBlockExceptionUpdateMany).toHaveBeenCalledWith({
      where: { blockId: currentBlock.id, date: { gte: expect.any(Date) } },
      data: { blockId: "future-block" },
    });
    expect(taskScheduleUpdateMany).toHaveBeenCalledWith({
      where: { timeBlockId: currentBlock.id, date: { gte: expect.any(Date) } },
      data: { timeBlockId: "future-block" },
    });
    expect(updated).toMatchObject({ id: "future-block", startMin: 600, endMin: 660 });
  });

  test("converts a one-off block into a recurring series from its original date", async () => {
    timeBlockRows = [{
      ...oneOffBlock,
      id: "historical-one-off",
      date: DateTime.fromISO("2026-09-07", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
    }];
    timeBlockFindFirst.mockClear();
    timeBlockFindMany.mockClear();
    timeBlockUpdate.mockClear();

    await new TimeBlockService().update("user-under-test", oneOffBlock.id, {
      date: null,
      daysOfWeek: [1, 2, 3],
      startMin: 510,
      endMin: 570,
      repeatEveryWeeks: 1,
      repeatEndsAt: null,
    });

    const update = timeBlockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data.date).toBeNull();
    expect(DateTime.fromJSDate(update.data.recurrenceStartsAt as Date, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-14");
    expect(update.data.daysOfWeek).toEqual([1, 2, 3]);
    expect(update.data.repeatEveryWeeks).toBe(1);
  });

  test("anchors a newly created recurring block at local midnight", async () => {
    timeBlockCreate.mockClear();

    await new TimeBlockService().create("user-under-test", {
      date: null,
      daysOfWeek: [1],
      startMin: 540,
      endMin: 600,
      repeatEveryWeeks: 1,
      repeatEndsAt: null,
    });

    const created = timeBlockCreate.mock.calls[0]?.[0] as { data: { date: Date | null; recurrenceStartsAt: Date } };
    expect(created.data.date).toBeNull();
    expect(DateTime.fromJSDate(created.data.recurrenceStartsAt, { zone: "America/Santo_Domingo" }).toISOTime()).toBe("00:00:00.000-04:00");
  });

  test("clears recurrence fields when converting a recurring block to one-off", async () => {
    calendarEventRows = [];
    timeBlockUpdate.mockClear();

    await new TimeBlockService().update("user-under-test", currentBlock.id, {
      date: "2026-09-21",
    });

    const update = timeBlockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(DateTime.fromJSDate(update.data.date as Date, { zone: "America/Santo_Domingo" }).toISODate()).toBe("2026-09-21");
    expect(update.data.recurrenceStartsAt).toBeNull();
    expect(update.data.repeatEveryWeeks).toBe(1);
    expect(update.data.repeatEndsAt).toBeNull();
    expect(update.data.daysOfWeek).toEqual([1]);
  });

  test("keeps a real active recurring conflict when converting a one-off block", async () => {
    timeBlockRows = [{
      ...currentBlock,
      id: "active-conflict",
      recurrenceStartsAt: DateTime.fromISO("2026-09-01", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate(),
      daysOfWeek: [1],
      startMin: 480,
      endMin: 600,
    }];
    timeBlockFindMany.mockClear();

    await expect(new TimeBlockService().update("user-under-test", oneOffBlock.id, {
      date: null,
      daysOfWeek: [1, 2, 3],
      startMin: 510,
      endMin: 570,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      details: {
        id: "active-conflict",
        date: "2026-09-14",
        startMin: 480,
        endMin: 600,
      },
    });
  });

  test("rejects an exception whose source date has no real occurrence", async () => {
    await expect(new TimeBlockService().createException("user-under-test", currentBlock.id, {
      date: "2026-09-18",
      action: "skip",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(timeBlockExceptionUpsert).not.toHaveBeenCalled();
  });

  test("creates a moved exception with the requested hours", async () => {
    calendarEventRows = [];

    await new TimeBlockService().createException("user-under-test", currentBlock.id, {
      date: "2026-09-17",
      targetDate: "2026-09-18",
      action: "move",
      startMin: 600,
      endMin: 660,
    });

    expect(timeBlockExceptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        date: calendarDate("2026-09-17"),
        targetDate: calendarDate("2026-09-18"),
        startMin: 600,
        endMin: 660,
      }),
    }));
  });

  test("rejects moving onto another occurrence of the same block", async () => {
    calendarEventRows = [];

    await expect(new TimeBlockService().createException("user-under-test", currentBlock.id, {
      date: "2026-09-17",
      targetDate: "2026-09-24",
      action: "move",
      startMin: 600,
      endMin: 660,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(timeBlockExceptionUpsert).not.toHaveBeenCalled();
  });

  test("rejects reusing a destination already used by a move exception", async () => {
    blockExceptions = [{
      id: "existing-move",
      blockId: currentBlock.id,
      userId: currentBlock.userId,
      date: calendarDate("2026-09-10"),
      targetDate: calendarDate("2026-09-18"),
      action: "move",
      startMin: 600,
      endMin: 660,
      createdAt,
      updatedAt: createdAt,
    }];
    calendarEventRows = [];

    await expect(new TimeBlockService().createException("user-under-test", currentBlock.id, {
      date: "2026-09-17",
      targetDate: "2026-09-18",
      action: "move",
      startMin: 600,
      endMin: 660,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(timeBlockExceptionUpsert).not.toHaveBeenCalled();
  });

  test("uses the following day as the inclusive exception range boundary", async () => {
    await new TimeBlockService().listAllExceptions(
      "user-under-test",
      calendarDate("2026-09-14"),
      calendarDate("2026-09-20"),
    );

    expect(timeBlockExceptionFindMany).toHaveBeenCalledWith({
      where: {
        userId: "user-under-test",
        OR: [
          { date: { gte: calendarDate("2026-09-14"), lt: calendarDate("2026-09-21") } },
          { targetDate: { gte: calendarDate("2026-09-14"), lt: calendarDate("2026-09-21") } },
        ],
      },
      orderBy: { date: "asc" },
    });
  });

  test("controller converts date-only exception query values before calling the service", async () => {
    const { TimeBlockController } = await import("./timeblocks.controller");
    const success = mock();
    const next = mock();
    const request = {
      query: { from: "2026-09-14", to: "2026-09-20" },
      user: { id: "user-under-test" },
    } as unknown as Request;

    await new TimeBlockController().listAllExceptions(
      request,
      { success } as unknown as Response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith([]);
    expect(timeBlockExceptionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-under-test" }),
    }));
  });
});
