import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function calendarDate(value: string | Date) {
  if (typeof value === "string") {
    // Date-only values ("YYYY-MM-DD) represent a local calendar day, not UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Devuelve el día calendario en hora local (YYYY-MM-DD) de un valor ISO (UTC),
 * de modo que una fecha como "2026-08-06T03:59:00.000Z" cuente como el 5 de
 * agosto en una zona horaria UTC-4.
 */
export function localDateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatRelativeDate(value: string | Date, lowercase = false, reference = new Date()) {
  const target = calendarDate(value);
  const today = calendarDate(reference);
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const difference = Math.round((targetDay - todayDay) / 86_400_000);

  let label: string;
  if (difference === -2) label = "Antes de ayer";
  else if (difference === -1) label = "Ayer";
  else if (difference === 0) label = "Hoy";
  else if (difference === 1) label = "Mañana";
  else if (difference === 2) label = "Pasado mañana";
  else label = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(target);

  return lowercase ? label.toLowerCase() : label;
}

export function formatCreatedAt(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShortDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function hasTimeComponent(value: string): boolean {
  return /T\d{2}:\d{2}/.test(value);
}

/**
 * Convierte un valor ISO (UTC) en el formato "YYYY-MM-DDTHH:mm" que espera
 * un input tipo datetime-local, usando la zona local del navegador.
 */
export function toDatetimeLocal(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Detecta valores legacy de fecha-sola: se guardaban a las 12:00 UTC.
 * Se tratan igual que 23:59 local (fin de día) para no romper la UI.
 */
export function isLegacyNoonDate(value: string | Date): boolean {
  const iso = value instanceof Date ? value.toISOString() : value;
  return /T12:00:00(\.000)?Z?$/.test(iso);
}

/**
 * Formatea una fecha ISO de vencimiento para las cards de tarea:
 * - "Hoy 14:30" / "Mañana 09:00" para los próximos 2 días
 * - "Mié 10:00" para esta semana
 * - "15/09 10:00" para fechas lejanas
 * - Si es fecha-sola (23:59 local o legacy 12:00 UTC) se omite la hora: "Hoy", "Mañana", "15/09"
 */
export function formatDateTime(value: string | Date, reference = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const target = calendarDate(date);
  const today = calendarDate(reference);
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const difference = Math.round((targetDay - todayDay) / 86_400_000);
  const isEndOfDay = (date.getHours() === 23 && date.getMinutes() === 59) || isLegacyNoonDate(value);
  const time = isEndOfDay ? "" : ` ${date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  const weekday = new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(date);

  if (difference === 0) return `Hoy${time}`;
  if (difference === 1) return `Mañana${time}`;
  if (difference === 2) return `Pasado mañana${time}`;
  if (difference > 2 && difference <= 6) {
    const short = weekday.replace(".", "");
    return `${short}${time}`;
  }
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}${time}`;
}

export function isTaskOverdue(task: { dueDate: string | null; status: string }) {
  if (!task.dueDate || task.status === "COMPLETED" || task.status === "CANCELLED") return false;
  if (isLegacyNoonDate(task.dueDate)) {
    const dueDate = calendarDate(task.dueDate);
    const today = calendarDate(new Date());
    return dueDate.getTime() < today.getTime();
  }
  return new Date(task.dueDate).getTime() < Date.now();
}
