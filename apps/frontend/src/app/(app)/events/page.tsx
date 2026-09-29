"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { AgendaCreateDialog } from "@/features/timeblocks/components/AgendaCreateDialog";
import "@/features/timeblocks/components/agenda.css";
import { useEventsQuery } from "@/features/events/hooks/useEvents";
import { EventPreviewModal } from "@/features/events/components/EventPreviewModal";
import { useTimeBlocksQuery } from "@/features/timeblocks/hooks/useTimeBlocks";
import type { CalendarEvent, TimeBlock } from "@/types/entities";
import { findAvailableStartMin } from "@/features/timeblocks/lib/availability";
import { parseDateOnly } from "@/features/timeblocks/lib/time";

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
  const eventsQuery = useEventsQuery(from, to);
  const { data: events = [], isLoading } = eventsQuery;
  const { data: blocks = [] } = useTimeBlocksQuery();
  const [creating, setCreating] = useState(false);
  const [previewingEvent, setPreviewingEvent] = useState<CalendarEvent | null>(null);
  const eventIdParam = searchParams.get("eventId");
  const handledEventIdRef = useRef<string | null>(null);

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

  const openCreate = () => setCreating(true);

  const openPreview = (event: CalendarEvent) => {
    setPreviewingEvent(event);
  };

  const groupedEvents = events.reduce((acc: Record<string, CalendarEvent[]>, event) => {
    const day = toLocalISODate(parseDateOnly(event.date));
    if (!acc[day]) acc[day] = [];
    acc[day].push(event);
    return acc;
  }, {});
  const gridStart = new Date(currentMonth);
  gridStart.setDate(1 - ((gridStart.getDay() + 6) % 7));
  const gridDays = Array.from({ length: Math.ceil((((currentMonth.getDay() + 6) % 7) + toDate.getDate()) / 7) * 7 }, (_, index) => {
    const day = new Date(gridStart); day.setDate(day.getDate() + index); return day;
  });

  return (
    <OfficialPage>
      <OfficialHeader eyebrow="AGENDA" title="Eventos" description="Tus compromisos, en perspectiva." actions={<button className="official-button" data-primary onClick={openCreate}><Plus size={18}/>Nuevo evento</button>}/>
      <div className="official-toolbar">
        <div className="flex items-center rounded-lg border border-outline-variant bg-white"><button className="official-button border-0" aria-label="Mes anterior" onClick={prevMonth}>‹</button><h2 className="px-4 text-sm capitalize">{currentMonth.toLocaleDateString("es", { month: "long", year: "numeric" })}</h2><button className="official-button border-0" aria-label="Mes siguiente" onClick={nextMonth}>›</button></div>
        <button className="official-button" onClick={() => setCurrentMonth(initialMonth(null))}>Hoy</button><Link className="official-button" href="/timeblocks">Ver agenda semanal</Link>
      </div>
      {eventsQuery.isError ? <div role="alert" className="official-panel"><p>No pudimos cargar los eventos.</p><button className="official-button mt-4" onClick={() => void eventsQuery.refetch()}>Reintentar</button></div> : isLoading ? <p>Cargando eventos…</p> : <div className="official-month" aria-label="Calendario mensual">
        <div className="official-month-weekdays">{["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="official-month-days">{gridDays.map(day => {
          const key = toLocalISODate(day), today = key === toLocalISODate(new Date());
          return <div className="official-month-day" key={key} data-today={today} data-outside={day.getMonth() !== currentMonth.getMonth()}>
            <time dateTime={key}>{day.getDate()}</time>
            {groupedEvents[key]?.map(event => <button key={event.id + event.date} onClick={() => openPreview(event)} className="official-month-event"><span>{event.title}</span><small>{event.allDay ? "Todo el día" : formatMin(event.startMin ?? 0)}</small></button>)}
          </div>;
        })}</div>
      </div>}
      {creating && <AgendaCreateDialog kind="event" slot={(() => { const schedule = defaultEventSchedule(events, blocks); return { date: schedule.date, startMin: schedule.startMin ?? 540, endMin: schedule.endMin ?? 600 }; })()} onClose={() => setCreating(false)} onCreated={result => { setCreating(false); if (result.kind === "event") { setCurrentMonth(initialMonth(result.event.date.slice(0,7))); setPreviewingEvent(result.event); } }}/>}
      {previewingEvent && (
        <EventPreviewModal
          event={previewingEvent}
          key={previewingEvent.id}
          onClose={() => setPreviewingEvent(null)}
        />
      )}
    </OfficialPage>
  );
}
