import { prisma } from "../src/infra/prisma/client";
import { calendarDateKey, todayCalendarStart } from "../src/utils/calendar-date";

type DateField = { ownerId: string; field: string; value: Date };

function isUtcMidnight(value: Date) {
  return value.getUTCHours() === 0
    && value.getUTCMinutes() === 0
    && value.getUTCSeconds() === 0
    && value.getUTCMilliseconds() === 0;
}

function duplicateMoveTargets(rows: Array<{ id: string; ownerId: string; targetDate: Date | null }>) {
  const groups = new Map<string, Array<{ id: string; ownerId: string }>>();
  for (const row of rows) {
    if (!row.targetDate) continue;
    const key = `${row.ownerId}:${calendarDateKey(row.targetDate)}`;
    groups.set(key, [...(groups.get(key) ?? []), { id: row.id, ownerId: row.ownerId }]);
  }
  return [...groups.entries()]
    .filter(([, exceptions]) => exceptions.length > 1)
    .map(([key, exceptions]) => ({ key, count: exceptions.length, exceptions }));
}

async function main() {
  const [blocks, events, blockExceptions, eventExceptions] = await Promise.all([
    prisma.timeBlock.findMany({
      select: { id: true, userId: true, date: true, recurrenceStartsAt: true, repeatEndsAt: true },
    }),
    prisma.calendarEvent.findMany({
      select: { id: true, userId: true, date: true, recurrenceStartsAt: true, recurrenceType: true, recurrenceEndsAt: true },
    }),
    prisma.timeBlockException.findMany({
      select: { id: true, blockId: true, targetDate: true },
    }),
    prisma.calendarEventException.findMany({
      select: { id: true, eventId: true, targetDate: true },
    }),
  ]);
  const today = todayCalendarStart();
  const dateFields: DateField[] = [
    ...blocks.flatMap((block) => [
      block.date ? { ownerId: block.id, field: "date", value: block.date } : null,
      block.recurrenceStartsAt ? { ownerId: block.id, field: "recurrenceStartsAt", value: block.recurrenceStartsAt } : null,
      block.repeatEndsAt ? { ownerId: block.id, field: "repeatEndsAt", value: block.repeatEndsAt } : null,
    ].filter((field): field is DateField => field !== null)),
    ...events.flatMap((event) => [
      { ownerId: event.id, field: "date", value: event.date },
      event.recurrenceStartsAt ? { ownerId: event.id, field: "recurrenceStartsAt", value: event.recurrenceStartsAt } : null,
      event.recurrenceEndsAt ? { ownerId: event.id, field: "recurrenceEndsAt", value: event.recurrenceEndsAt } : null,
    ].filter((field): field is DateField => field !== null)),
  ];
  const utcMidnight = dateFields
    .filter((field) => isUtcMidnight(field.value))
    .map((field) => ({ ...field, date: calendarDateKey(field.value) }));
  const report = {
    generatedAt: new Date().toISOString(),
    timezone: "America/Santo_Domingo",
    timeBlocks: {
      total: blocks.length,
      recurringWithoutAnchor: blocks.filter((block) => !block.date && !block.recurrenceStartsAt).map((block) => block.id),
      endedBeforeToday: blocks.filter((block) => block.repeatEndsAt && block.repeatEndsAt < today).map((block) => ({ id: block.id, end: calendarDateKey(block.repeatEndsAt!) })),
    },
    events: {
      total: events.length,
      recurringWithoutAnchor: events.filter((event) => event.recurrenceType && !event.recurrenceStartsAt).map((event) => event.id),
      endedBeforeToday: events.filter((event) => event.recurrenceType && event.recurrenceEndsAt && event.recurrenceEndsAt < today).map((event) => ({ id: event.id, end: calendarDateKey(event.recurrenceEndsAt!) })),
    },
    exceptions: {
      timeBlocks: blockExceptions.length,
      events: eventExceptions.length,
      duplicateTimeBlockMoveTargets: duplicateMoveTargets(blockExceptions.map((exception) => ({ id: exception.id, ownerId: exception.blockId, targetDate: exception.targetDate }))),
      duplicateEventMoveTargets: duplicateMoveTargets(eventExceptions.map((exception) => ({ id: exception.id, ownerId: exception.eventId, targetDate: exception.targetDate }))),
    },
    utcMidnightDateFields: utcMidnight,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
