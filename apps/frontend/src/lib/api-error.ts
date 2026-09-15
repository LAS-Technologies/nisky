import type { ApiError, CalendarConflictDetails } from "@/types/api.types";

function isCalendarConflictDetails(value: unknown): value is CalendarConflictDetails {
  if (!value || typeof value !== "object") return false;
  const details = value as Partial<CalendarConflictDetails>;
  return (details.kind === "TIME_BLOCK" || details.kind === "EVENT")
    && typeof details.id === "string"
    && typeof details.label === "string"
    && typeof details.date === "string"
    && typeof details.startMin === "number"
    && typeof details.endMin === "number";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-DO", { day: "numeric", month: "long" });
}

function formatMinutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const candidate = error as Partial<ApiError>;
  if (typeof candidate.message !== "string" || candidate.message.length === 0) return fallback;
  if (candidate.code === "CONFLICT" && isCalendarConflictDetails(candidate.details)) {
    return `${candidate.message} (${formatDate(candidate.details.date)}, ${formatMinutes(candidate.details.startMin)}–${formatMinutes(candidate.details.endMin)})`;
  }
  return candidate.message;
}
