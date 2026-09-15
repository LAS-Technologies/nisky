import { DateTime } from "luxon";
import { describe, expect, mock, test } from "bun:test";
import type { TimeBlock } from "../../infra/prisma/generated/prisma/client";

const createdAt = DateTime.fromISO("2026-09-03", { zone: "America/Santo_Domingo" }).startOf("day").toJSDate();
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

const timeBlockFindFirst = mock(async ({ where }: { where: { id: string | { not: string } } }) =>
  where.id === currentBlock.id ? currentBlock : null,
);
const timeBlockFindMany = mock(async () => []);
const timeBlockUpdate = mock(async ({ data }: { data: unknown }) => data);
const timeBlockCreate = mock(async ({ data }: { data: Record<string, unknown> }) => ({ id: "future-block", ...data }));
const timeBlockExceptionFindMany = mock(async () => []);
const timeBlockExceptionUpdateMany = mock(async () => ({ count: 0 }));
const timeBlockExceptionCreate = mock(async ({ data }: { data: Record<string, unknown> }) => data);
const taskScheduleUpdateMany = mock(async () => ({ count: 0 }));
const calendarEventFindMany = mock(async () => []);
const transaction = mock(async (callback: (tx: unknown) => Promise<unknown>) => callback({
  timeBlock: { create: timeBlockCreate, update: timeBlockUpdate },
  timeBlockException: {
    findMany: timeBlockExceptionFindMany,
    updateMany: timeBlockExceptionUpdateMany,
    create: timeBlockExceptionCreate,
  },
  taskSchedule: { updateMany: taskScheduleUpdateMany },
}));

mock.module("../../infra/prisma/client", () => ({
  prisma: {
    project: { findFirst: mock(async () => null) },
    timeBlock: { findFirst: timeBlockFindFirst, findMany: timeBlockFindMany },
    timeBlockException: { findMany: timeBlockExceptionFindMany },
    calendarEvent: { findMany: calendarEventFindMany },
    $transaction: transaction,
  },
}));

const { TimeBlockService } = await import("./timeblocks.service");

describe("TimeBlockService.update", () => {
  test("splits a recurring block without changing its historical series", async () => {
    timeBlockCreate.mockClear();
    timeBlockUpdate.mockClear();
    timeBlockExceptionUpdateMany.mockClear();
    taskScheduleUpdateMany.mockClear();

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
});
