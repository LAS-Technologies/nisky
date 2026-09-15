"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useEventMutations, useEventsQuery } from "@/features/events/hooks/useEvents";
import { EventPreviewModal } from "@/features/events/components/EventPreviewModal";
import { useTimeBlocksQuery } from "@/features/timeblocks/hooks/useTimeBlocks";
import type { CalendarEvent, TimeBlock } from "@/types/entities";
import { PROJECT_COLORS } from "@/components/ui/ColorPicker";
import { findAvailableStartMin } from "@/features/timeblocks/lib/availability";
import { hexToRgba, parseDateOnly } from "@/features/timeblocks/lib/time";

function toLocalISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function initialMonth(monthParam: string | null) {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    const parsed = new Date(year, month - 1, 1);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month - 1) return parsed;
  }
  const current = new Date();
  return new Date(current.getFullYear(), current.getMonth(), 1);
}

function formatMin(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function defaultEventSchedule(events: CalendarEvent[], blocks: TimeBlock[]) {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const preferredStartMin = Math.min(Math.max(Math.ceil(currentMin / 15) * 15, 6 * 60), 22 * 60);
  const date = toLocalISODate(now);
  const startMin = findAvailableStartMin({
    blocks,
    dateKey: date,
    dayOfWeek: now.getDay(),
    events,
    preferredStartMin,
  });
  return {
    allDay: startMin === null,
    date,
    endMin: startMin === null ? undefined : startMin + 60,
    startMin,
  };
}

export default function EventsPage() {
  const searchParams = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(() => initialMonth(searchParams.get("month")));
  const from = toLocalISODate(currentMonth);
  const toDate = new Date(currentMonth);
  toDate.setMonth(toDate.getMonth() + 1);
  toDate.setDate(0);
  const to = toLocalISODate(toDate);
  const { data: events = [], isLoading } = useEventsQuery(from, to);
  const { data: blocks = [] } = useTimeBlocksQuery();
  const { createEvent } = useEventMutations();
  const [previewingEvent, setPreviewingEvent] = useState<CalendarEvent | null>(null);
  const eventIdParam = searchParams.get("eventId");
  const handledEventIdRef = useRef<string | null>(null);
  const creatingEventRef = useRef(false);

  useEffect(() => {
    if (!eventIdParam || handledEventIdRef.current === eventIdParam || previewingEvent || isLoading) return;
    const target = events.find((event) => event.id === eventIdParam);
    if (target) {
      // The URL is the source of truth for opening a deep-linked event.
      handledEventIdRef.current = eventIdParam;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewingEvent(target);
    }
  }, [eventIdParam, events, isLoading, previewingEvent]);

  const prevMonth = () => setCurrentMonth((month) => {
    const next = new Date(month);
    next.setMonth(next.getMonth() - 1);
    return next;
  });

  const nextMonth = () => setCurrentMonth((month) => {
    const next = new Date(month);
    next.setMonth(next.getMonth() + 1);
    return next;
  });

  const openCreate = async () => {
    if (creatingEventRef.current) return;
    creatingEventRef.current = true;
    const schedule = defaultEventSchedule(events, blocks);
    try {
      const created = await createEvent.mutateAsync({
        title: "Nuevo evento",
        date: schedule.date,
        allDay: schedule.allDay,
        startMin: schedule.allDay ? undefined : schedule.startMin ?? undefined,
        endMin: schedule.endMin,
        color: PROJECT_COLORS[0] ?? "#0f172a",
        recurrenceType: null,
        recurrenceInterval: 1,
        recurrenceDaysOfWeek: [],
        recurrenceDayOfMonth: null,
        recurrenceEndsAt: null,
        remindBeforeMin: 0,
      });
      setPreviewingEvent(created);
      toast.success("Evento creado");
    } catch (error) {
      toast.error((error as { message?: string } | null)?.message ?? "Ups, no pudimos crear el evento. Inténtalo de nuevo.");
    } finally {
      creatingEventRef.current = false;
    }
  };

  const openPreview = (event: CalendarEvent) => {
    setPreviewingEvent(event);
  };

  const groupedEvents = events.reduce((acc: Record<string, CalendarEvent[]>, event) => {
    const day = toLocalISODate(parseDateOnly(event.date));
    if (!acc[day]) acc[day] = [];
    acc[day].push(event);
    return acc;
  }, {});
  const sortedDays = Object.keys(groupedEvents).sort();

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface p-container-padding">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button onClick={prevMonth} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:border-outline hover:bg-surface-container-low hover:text-on-surface sm:h-10 sm:w-10" type="button" aria-label="Mes anterior">&lt;</button>
          <h2 className="truncate font-headline-sm text-base text-on-surface sm:text-headline-sm">
            {currentMonth.toLocaleDateString("es", { month: "long", year: "numeric" }).replace(/^\p{L}/u, (char) => char.toUpperCase())}
          </h2>
          <button onClick={nextMonth} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:border-outline hover:bg-surface-container-low hover:text-on-surface sm:h-10 sm:w-10" type="button" aria-label="Mes siguiente">&gt;</button>
        </div>
        <button
          disabled={createEvent.isPending}
          onClick={() => void openCreate()}
          className="flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 py-2 font-body-sm text-body-sm text-on-primary shadow-cadence-1 transition-colors hover:bg-primary/90 disabled:opacity-50 sm:px-4"
          type="button"
        >
          <Plus size={18} className="shrink-0 sm:size-5" />
          <span className="hidden sm:inline">Nuevo evento</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-container-padding sm:p-section-gap">
        {isLoading ? (
          <p className="text-on-surface-variant">Cargando...</p>
        ) : sortedDays.length === 0 ? (
          <p className="py-8 text-center text-on-surface-variant">No hay eventos este mes.</p>
        ) : (
          <div className="space-y-8">
            {sortedDays.map((day) => (
              <div key={day}>
                <h3 className="mb-4 border-b border-outline-variant pb-3 font-headline-xs text-headline-xs text-on-surface">
                  {new Date(`${day}T00:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupedEvents[day].map((event) => {
                    const eventColor = event.color ?? "#303e51";
                    return (
                      <button
                        key={`${event.id}-${event.date}`}
                        onClick={() => {
                           openPreview(event);
                        }}
                        className="flex min-h-20 flex-col rounded-lg border border-outline-variant bg-surface p-4 text-left shadow-cadence-1 transition-colors hover:border-outline hover:shadow-cadence-2"
                        style={{ borderLeft: `3px solid ${eventColor}`, backgroundColor: hexToRgba(eventColor, 0.06) }}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eventColor }} />
                          <div className="font-headline-xs text-headline-xs font-semibold text-on-surface">{event.title}</div>
                        </div>
                        <div className="mt-2 flex items-center gap-4 font-body-sm text-body-sm text-on-surface-variant">
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            {event.allDay ? "Todo el día" : `${formatMin(event.startMin!)} - ${formatMin(event.endMin!)}`}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 truncate">
                              <MapPin size={14} />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewingEvent && (
        <EventPreviewModal
          event={previewingEvent}
          key={previewingEvent.id}
          occurrenceDate={parseDateOnly(previewingEvent.date)}
          onClose={() => setPreviewingEvent(null)}
        />
      )}
    </div>
  );
}
