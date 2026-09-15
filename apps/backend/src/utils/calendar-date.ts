import { DateTime } from "luxon";

export const CALENDAR_TIME_ZONE = "America/Santo_Domingo";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string) {
  if (!calendarDatePattern.test(value)) return false;
  const parsed = DateTime.fromISO(value, { zone: CALENDAR_TIME_ZONE });
  return parsed.isValid && parsed.toISODate() === value;
}

export function parseCalendarDate(value: string) {
  if (!isCalendarDate(value)) throw new RangeError("La fecha no es válida");
  return DateTime.fromISO(value, { zone: CALENDAR_TIME_ZONE }).startOf("day");
}

export function calendarDateToDate(value: string) {
  return parseCalendarDate(value).toJSDate();
}

export function calendarDayStart(value: Date, zone = CALENDAR_TIME_ZONE) {
  return DateTime.fromJSDate(value, { zone }).startOf("day").toJSDate();
}

export function nextCalendarDayStart(value: Date, zone = CALENDAR_TIME_ZONE) {
  return DateTime.fromJSDate(value, { zone }).startOf("day").plus({ days: 1 }).toJSDate();
}

export function todayCalendarStart(zone = CALENDAR_TIME_ZONE) {
  return DateTime.now().setZone(zone).startOf("day").toJSDate();
}

export function calendarDateKey(value: Date, zone = CALENDAR_TIME_ZONE) {
  return DateTime.fromJSDate(value, { zone }).toISODate()!;
}
