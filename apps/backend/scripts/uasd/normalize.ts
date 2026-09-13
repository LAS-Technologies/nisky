import { DateTime } from "luxon";
import { isUasdHost, UASD_TIME_ZONE, UasdError } from "./types";
import type { UasdActivityDetails, UasdActivityKind, UasdCalendarEvent, UasdRemoteItem, UasdSelectionRecord } from "./types";

const MONTHS: Record<string, number> = {
  enero: 1,
  january: 1,
  febrero: 2,
  february: 2,
  marzo: 3,
  march: 3,
  abril: 4,
  april: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  june: 6,
  julio: 7,
  july: 7,
  agosto: 8,
  august: 8,
  septiembre: 9,
  setiembre: 9,
  september: 9,
  octubre: 10,
  october: 10,
  noviembre: 11,
  november: 11,
  diciembre: 12,
  december: 12,
};

const DATE_RE_SOURCE = String.raw`(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*,?\s*(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})(?:\s*,?\s+(\d{1,2}):(\d{2})(?:\s*(a\.?\s*m\.?|p\.?\s*m\.?))?)?`;
const DATE_RE = new RegExp(DATE_RE_SOURCE, "iu");
const ACTIVITY_PATH_RE = /(?:^|\/)mod\/(assign|quiz|forum)\/view\.php$/i;
const COURSE_PATH_RE = /(?:^|\/)course\/view\.php$/i;

export function parseUasdDate(text: string): string | null {
  const match = DATE_RE.exec(text.replace(/\s+/g, " ").trim());
  return match ? dateFromMatch(match) : null;
}

export function parseUasdDates(text: string): string[] {
  const dates: string[] = [];
  const matcher = new RegExp(DATE_RE_SOURCE, "giu");
  const normalized = text.replace(/\s+/g, " ").trim();
  for (const match of normalized.matchAll(matcher)) {
    const date = dateFromMatch(match);
    if (date) dates.push(date);
  }
  return dates;
}

function dateFromMatch(match: RegExpExecArray | RegExpMatchArray): string | null {
  if (!match) return null;
  const month = MONTHS[match[2]!.toLocaleLowerCase()];
  if (!month) return null;

  let hour = match[4] ? Number(match[4]) : 0;
  const meridiem = match[6]?.toLocaleLowerCase().replace(/\s|\./g, "");
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  const date = DateTime.fromObject(
    {
      year: Number(match[3]),
      month,
      day: Number(match[1]),
      hour,
      minute: match[5] ? Number(match[5]) : 0,
      second: 0,
      millisecond: 0,
    },
    { zone: UASD_TIME_ZONE },
  );
  return date.isValid ? date.toISO() : null;
}

export function calendarDate(year: number, month: number, day: number): string {
  const date = DateTime.fromObject({ year, month, day, hour: 23, minute: 59, second: 0, millisecond: 0 }, { zone: UASD_TIME_ZONE });
  if (!date.isValid) throw new UasdError("PARSE_ERROR", "La fecha del calendario UASD no es válida");
  return date.toISO();
}

export function monthRange(from: string, to: string): DateTime[] {
  const start = DateTime.fromISO(from, { zone: UASD_TIME_ZONE }).startOf("month");
  const end = DateTime.fromISO(to, { zone: UASD_TIME_ZONE }).startOf("month");
  if (!start.isValid || !end.isValid || end < start) {
    throw new UasdError("INVALID_INPUT", "El rango de fechas UASD no es válido");
  }

  const months: DateTime[] = [];
  for (let current = start; current <= end; current = current.plus({ months: 1 })) months.push(current);
  return months;
}

export function activityKindFromPath(pathname: string): UasdActivityKind | null {
  const match = ACTIVITY_PATH_RE.exec(pathname);
  if (!match) return null;
  const kind = match[1]!.toLowerCase();
  if (kind === "assign") return "assignment";
  if (kind === "quiz" || kind === "forum") return kind;
  return null;
}

export function activityUrl(rawUrl: string, expectedHost?: string): { host: string; kind: UasdActivityKind; activityId: string; url: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UasdError("PARSE_ERROR", "El enlace de actividad UASD no es válido");
  }
  if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") || !isUasdHost(url.hostname)) {
    throw new UasdError("UNEXPECTED_HOST", "El enlace de actividad UASD apunta a un host no permitido");
  }
  if (expectedHost && url.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    throw new UasdError("UNEXPECTED_HOST", "El enlace de actividad UASD cambió de host inesperadamente");
  }
  const kind = activityKindFromPath(url.pathname);
  const id = url.searchParams.get("id");
  if (!kind || !id || !/^\d+$/.test(id)) throw new UasdError("PARSE_ERROR", "El enlace de actividad UASD no contiene un id válido");
  return { host: url.hostname, kind, activityId: id, url: `${url.origin}${url.pathname}?id=${encodeURIComponent(id)}` };
}

export function courseUrl(rawUrl: string): { host: string; courseId: string; url: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UasdError("PARSE_ERROR", "La URL final del curso UASD no es válida");
  }
  if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") || !isUasdHost(url.hostname)) throw new UasdError("UNEXPECTED_HOST", "El curso UASD terminó en un host no permitido");
  if (!COURSE_PATH_RE.test(url.pathname)) throw new UasdError("PARSE_ERROR", "El handoff UASD no termino en un curso");
  const id = url.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) throw new UasdError("PARSE_ERROR", "El curso UASD no contiene un id válido");
  return { host: url.hostname, courseId: id, url: `${url.origin}${url.pathname}?id=${encodeURIComponent(id)}` };
}

export function chooseTarget(record: UasdSelectionRecord): string {
  // The student branch of the gateway submits URL; URL2 belongs to the teacher UI.
  return record.URL;
}

export function calendarEventKey(host: string, courseId: string, kind: UasdActivityKind, activityId: string): string {
  return `${host}:${courseId}:${kind}:${activityId}`;
}

export function mergeCalendarEvents(events: UasdCalendarEvent[]): UasdCalendarEvent[] {
  const merged = new Map<string, UasdCalendarEvent>();
  for (const event of events) {
    const previous = merged.get(event.key);
    if (!previous || isBetterCalendarEvent(event, previous)) merged.set(event.key, event);
  }
  return [...merged.values()].sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.key.localeCompare(b.key));
}

function isBetterCalendarEvent(candidate: UasdCalendarEvent, previous: UasdCalendarEvent): boolean {
  const candidateName = candidate.eventName.toLocaleLowerCase();
  const previousName = previous.eventName.toLocaleLowerCase();
  const candidatePriority = candidateName.includes("cierra") || candidateName.includes("pendiente") ? 2 : candidateName.includes("abre") ? 1 : 0;
  const previousPriority = previousName.includes("cierra") || previousName.includes("pendiente") ? 2 : previousName.includes("abre") ? 1 : 0;
  return candidatePriority > previousPriority;
}

export function cleanActivityTitle(value: string): string {
  return value
    .replace(/^\s*(?:Vencimiento de|Se cierra|Se cerró|Se abre|Inicio de)\s+/iu, "")
    .replace(/\s+(?:pendiente|abre|se cierra|se cerró)\.?\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toRemoteItem(
  event: UasdCalendarEvent,
  details: Pick<UasdActivityDetails, "title" | "completed" | "dueDate" | "openDate" | "closeDate" | "source">,
  course: string | null,
): UasdRemoteItem {
  const dueDate = details.dueDate ?? (event.eventName.toLocaleLowerCase().includes("pendiente") || event.eventName.toLocaleLowerCase().includes("cierra") ? event.eventDate : null);
  return {
    key: event.key,
    kind: event.kind,
    title: cleanActivityTitle(details.title || event.title),
    description: [course, `Link: ${event.url}`].filter(Boolean).join("\n") || null,
    course,
    url: event.url,
    completed: details.completed,
    dueDate,
    openDate: details.openDate,
    closeDate: details.closeDate,
    source: details.source,
  };
}
