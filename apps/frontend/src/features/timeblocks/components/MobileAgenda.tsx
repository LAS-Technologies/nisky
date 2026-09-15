"use client";

import { Fragment } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import type { CalendarEvent, Project, TimeBlock, TimeBlockException } from "@/types/entities";
import { cn } from "@/lib/utils";
import { FAB } from "@/components/ui/FAB";
import { DAY_ORDER, hexToRgba, minToTime, parseDateOnly, toDateKey } from "../lib/time";

type MobileAgendaView = "day" | "week";

type AgendaItem = {
  kind: "block" | "event";
  id: string;
  title: string;
  subtitle: string;
  startMin: number;
  endMin: number;
  color: string;
  block?: TimeBlock;
  event?: CalendarEvent;
};

const DAY_LETTERS: Record<number, string> = {
  0: "D",
  1: "L",
  2: "M",
  3: "X",
  4: "J",
  5: "V",
  6: "S",
};

function monday(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function blockOccurrenceOn(block: TimeBlock, date: Date, exceptions: TimeBlockException[]) {
  const exception = exceptions.find(
    (item) => item.blockId === block.id && sameLocalDay(parseDateOnly(item.date), date),
  );
  if (exception?.action === "skip") return null;
  if (exception?.action === "move" && exception.targetDate) return null;
  if (exception?.action === "move" && exception.startMin !== null && exception.endMin !== null) {
    return { startMin: exception.startMin, endMin: exception.endMin };
  }

  const movedException = exceptions.find(
    (item) => item.blockId === block.id
      && item.action === "move"
      && item.targetDate
      && sameLocalDay(parseDateOnly(item.targetDate), date),
  );
  if (movedException && movedException.startMin !== null && movedException.endMin !== null) {
    return { startMin: movedException.startMin, endMin: movedException.endMin };
  }

  if (block.date && !sameLocalDay(parseDateOnly(block.date), date)) return null;
  if (block.recurrenceStartsAt && parseDateOnly(block.recurrenceStartsAt).getTime() > new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) return null;
  if (!block.daysOfWeek.includes(date.getDay())) return null;
  if (block.repeatEndsAt && parseDateOnly(block.repeatEndsAt).getTime() < new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) return null;
  if (block.repeatEveryWeeks > 1) {
    const weeks = Math.floor((monday(date).getTime() - monday(parseDateOnly(block.recurrenceStartsAt ?? block.createdAt)).getTime()) / (7 * 86_400_000));
    if (weeks < 0 || weeks % block.repeatEveryWeeks !== 0) return null;
  }

  return {
    startMin: block.startMin,
    endMin: block.endMin,
  };
}

function formatDuration(startMin: number, endMin: number) {
  const duration = Math.max(endMin - startMin, 0);
  return `${Math.floor(duration / 60)}h ${String(duration % 60).padStart(2, "0")}m`;
}

function formatDate(date: Date) {
  const label = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCompactDate(date: Date) {
  const label = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date).replaceAll(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildDays(weekStart: Date) {
  return DAY_ORDER.map((dayOfWeek, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { date, dayOfWeek, key: toDateKey(date) };
  });
}

function buildAgendaItems(
  date: Date,
  blocks: TimeBlock[],
  projects: Project[],
  events: CalendarEvent[],
  exceptions: TimeBlockException[],
) {
  const blockItems: AgendaItem[] = blocks.flatMap((block) => {
    const occurrence = blockOccurrenceOn(block, date, exceptions);
    if (!occurrence) return [];
    const project = projects.find((item) => item.id === block.projectId);
    const title = block.name ?? project?.name ?? "Tiempo libre";
    const subtitle = project?.name && project.name !== title
      ? project.name
      : block.isActive
        ? "Tiempo para trabajar"
        : "Bloque pausado";
    return [{
      kind: "block",
      id: block.id,
      title,
      subtitle,
      startMin: occurrence.startMin,
      endMin: occurrence.endMin,
      color: project?.color ?? "#7a8494",
      block,
    }];
  });

  const eventItems: AgendaItem[] = events
    .filter((event) => !event.allDay && event.startMin !== null && event.endMin !== null)
    .filter((event) => sameLocalDay(parseDateOnly(event.date), date))
    .map((event) => ({
      kind: "event",
      id: event.id,
      title: event.title,
      subtitle: event.location ?? "Evento",
      startMin: event.startMin!,
      endMin: event.endMin!,
      color: event.color ?? "#316bf3",
      event,
    }));

  return [...blockItems, ...eventItems].sort(
    (a, b) => a.startMin - b.startMin || (a.kind === "event" ? -1 : 1),
  );
}

function DaySelector({
  days,
  selectedDate,
  onSelect,
}: {
  days: Array<{ date: Date; dayOfWeek: number; key: string }>;
  selectedDate: Date;
  onSelect: (date: Date) => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  return (
    <nav aria-label="Días de la semana" className="grid grid-cols-7 gap-1 border-b border-outline-variant pb-4">
      {days.map((day) => {
        const selected = day.key === selectedKey;
        return (
          <button
            aria-current={selected ? "date" : undefined}
            aria-label={day.date.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" })}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl transition-colors",
              selected
                ? "bg-primary-container text-on-primary shadow-cadence-1"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
            )}
            key={day.key}
            onClick={() => onSelect(day.date)}
            type="button"
          >
            <span className="font-label-caps text-label-caps">{DAY_LETTERS[day.dayOfWeek]}</span>
            <span className={cn("font-headline-sm text-headline-sm", selected ? "font-semibold" : "font-medium")}>{day.date.getDate()}</span>
          </button>
        );
      })}
    </nav>
  );
}

function NowDivider({ nowMin }: { nowMin: number }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4" aria-label={`Hora actual ${minToTime(nowMin)}`}>
      <span />
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary" />
        <span className="h-px flex-1 bg-secondary/60" />
        <span className="font-data-mono text-data-mono text-sm font-medium text-secondary">{minToTime(nowMin)}</span>
      </div>
    </div>
  );
}

function AgendaItemRow({
  item,
  date,
  onBlockClick,
  onEventClick,
}: {
  item: AgendaItem;
  date: Date;
  onBlockClick: (block: TimeBlock, date: Date) => void;
  onEventClick: (event: CalendarEvent, date: Date) => void;
}) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-x-4">
      <time className="pt-4 font-data-mono text-data-mono text-base text-on-surface-variant" dateTime={`${toDateKey(date)}T${minToTime(item.startMin)}`}>
        {minToTime(item.startMin)}
      </time>
      <button
        className={cn(
          "w-full rounded-2xl border border-l-[3px] px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
          "min-h-28 border-outline-variant/70 bg-surface-container-lowest shadow-sm hover:border-outline hover:bg-surface-container-low",
        )}
         onClick={() => {
           if (item.block) onBlockClick(item.block, date);
           else if (item.event) onEventClick(item.event, date);
         }}
        style={{
          borderLeftColor: item.color,
          backgroundColor: hexToRgba(item.color, 0.035),
        }}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {item.title}
          </span>
          <span className="shrink-0 font-data-mono text-data-mono text-sm text-on-surface-variant">
            {formatDuration(item.startMin, item.endMin)}
          </span>
        </div>
        <p className="mt-2 truncate font-body-md text-body-md text-on-surface-variant">
          {item.subtitle}
        </p>
      </button>
    </div>
  );
}

function MobileDayAgenda({
  date,
  items,
  events,
  dayTaskCount,
  dayStartMin,
  dayEndMin,
  onBlockClick,
  onEventClick,
  onDayTasksClick,
}: {
  date: Date;
  items: AgendaItem[];
  events: CalendarEvent[];
  dayTaskCount: number;
  dayStartMin: number;
  dayEndMin: number;
  onBlockClick: (block: TimeBlock, date: Date) => void;
  onEventClick: (event: CalendarEvent, date: Date) => void;
  onDayTasksClick: (date: string) => void;
}) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = sameLocalDay(now, date) && nowMin >= dayStartMin && nowMin <= dayEndMin;
  const allDayEvents = events.filter((event) => event.allDay && sameLocalDay(parseDateOnly(event.date), date));
  const nowIndex = showNow ? items.findIndex((item) => nowMin <= item.startMin) : -1;
  const dueTaskLabel = dayTaskCount === 1 ? "1 tarea vence" : `${dayTaskCount} tareas vencen`;

  return (
    <div className="mt-7 space-y-4">
      {allDayEvents.length > 0 && (
        <div className="rounded-2xl border border-secondary-fixed bg-surface-container-low px-4 py-3">
          <p className="font-label-caps text-label-caps text-secondary">TODO EL DÍA</p>
           <div className="mt-2 flex flex-wrap gap-2">
             {allDayEvents.map((event) => <button className="rounded-full bg-surface-container-high px-3 py-1 font-body-sm text-body-sm text-on-surface hover:bg-surface-container-highest" key={event.id} onClick={() => onEventClick(event, date)} type="button">{event.title}</button>)}
          </div>
        </div>
      )}
      {dayTaskCount > 0 && (
        <button
           aria-label={`Ver ${dueTaskLabel}`}
          className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary-fixed/30 px-4 py-3 text-left shadow-cadence-1 transition-colors hover:border-primary/45 hover:bg-primary-fixed/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => onDayTasksClick(toDateKey(date))}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
              <ListChecks aria-hidden="true" size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-body-md text-body-md font-semibold text-on-surface">
                {dueTaskLabel}
              </span>
              <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">
                Revisar en Tareas
              </span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="shrink-0 text-primary" size={20} />
        </button>
      )}
      {items.length === 0 && !showNow && dayTaskCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest px-5 py-12 text-center">
          <p className="font-headline-sm text-headline-sm font-semibold text-on-surface">Día despejado</p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">No hay bloques ni eventos reservados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => {
            return (
              <Fragment key={`${item.kind}-${item.id}`}>
                {index === nowIndex && <NowDivider nowMin={nowMin} />}
                 <AgendaItemRow date={date} item={item} onBlockClick={onBlockClick} onEventClick={onEventClick} />
              </Fragment>
            );
          })}
          {showNow && nowIndex === -1 && <NowDivider nowMin={nowMin} />}
        </div>
      )}
    </div>
  );
}

function MobileWeekAgenda({
  days,
  selectedDate,
  blocks,
  projects,
  events,
  exceptions,
  dueTaskCountsByDate,
  onDayTasksClick,
  onDateChange,
  onBlockClick,
  onEventClick,
}: {
  days: Array<{ date: Date; dayOfWeek: number; key: string }>;
  selectedDate: Date;
  blocks: TimeBlock[];
  projects: Project[];
  events: CalendarEvent[];
  exceptions: TimeBlockException[];
  dueTaskCountsByDate: Record<string, number>;
  onDayTasksClick: (date: string) => void;
  onDateChange: (date: Date) => void;
  onBlockClick: (block: TimeBlock, date: Date) => void;
  onEventClick: (event: CalendarEvent, date: Date) => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  return (
    <div className="mt-7 space-y-3">
      {days.map((day) => {
        const items = buildAgendaItems(day.date, blocks, projects, events, exceptions);
        const dueTaskCount = dueTaskCountsByDate[day.key] ?? 0;
        const dueTaskLabel = dueTaskCount === 1 ? "1 vence" : `${dueTaskCount} vencen`;
        const selected = day.key === selectedKey;
        return (
          <section className={cn("overflow-hidden rounded-2xl border bg-surface-container-lowest", selected ? "border-secondary shadow-sm" : "border-outline-variant/70")} key={day.key}>
            <div className="flex min-h-14 items-center gap-3 border-b border-outline-variant/70 px-4">
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onDateChange(day.date)} type="button">
                <span className="font-label-caps text-label-caps text-secondary">{DAY_LETTERS[day.dayOfWeek]}</span>
                <span className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">{formatDate(day.date)}</span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-data-mono text-data-mono text-xs text-on-surface-variant">{items.length}</span>
                {dueTaskCount > 0 && (
                  <button
                    aria-label={`Ver ${dueTaskCount} ${dueTaskCount === 1 ? "tarea con vencimiento" : "tareas con vencimiento"}`}
                    className="rounded-full bg-primary-container px-2 py-0.5 font-label-caps text-[10px] uppercase text-on-primary transition-colors hover:bg-primary-container/80"
                    onClick={() => onDayTasksClick(day.key)}
                    type="button"
                  >
                    {dueTaskLabel}
                  </button>
                )}
              </div>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-4 font-body-sm text-body-sm text-on-surface-variant">{dueTaskCount > 0 ? "No hay bloques ni eventos reservados." : "Día despejado"}</p>
            ) : (
              <div className="divide-y divide-outline-variant/70">
                {items.slice(0, 5).map((item) => (
                  <button
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-surface-container-low"
                    key={`${item.kind}-${item.id}`}
                     onClick={() => {
                        if (item.block) onBlockClick(item.block, day.date);
                        else if (item.event) onEventClick(item.event, day.date);
                     }}
                    type="button"
                  >
                    <span className="w-12 shrink-0 font-data-mono text-data-mono text-xs text-on-surface-variant">{minToTime(item.startMin)}</span>
                    <span className="min-w-0 flex-1 truncate font-body-md text-body-md text-on-surface">{item.title}</span>
                    <span className="shrink-0 font-data-mono text-data-mono text-xs text-on-surface-variant">{formatDuration(item.startMin, item.endMin)}</span>
                  </button>
                ))}
                {items.length > 5 && <p className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">+{items.length - 5} más</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function MobileAgenda({
  blocks,
  projects,
  events,
  exceptions,
  dueTaskCountsByDate,
  weekStart,
  selectedDate,
  view,
  dayStartMin,
  dayEndMin,
  onViewChange,
  onDateChange,
  onPreviousDay,
  onNextDay,
  onToday,
  onBlockClick,
  onEventClick,
  onDayTasksClick,
  onAdd,
}: {
  blocks: TimeBlock[];
  projects: Project[];
  events: CalendarEvent[];
  exceptions: TimeBlockException[];
  dueTaskCountsByDate: Record<string, number>;
  weekStart: Date;
  selectedDate: Date;
  view: MobileAgendaView;
  dayStartMin: number;
  dayEndMin: number;
  onViewChange: (view: MobileAgendaView) => void;
  onDateChange: (date: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onBlockClick: (block: TimeBlock, date?: Date) => void;
  onEventClick: (event: CalendarEvent, date: Date) => void;
  onDayTasksClick: (date: string) => void;
  onAdd: () => void;
}) {
  const days = buildDays(weekStart);
  const items = buildAgendaItems(selectedDate, blocks, projects, events, exceptions);
  const selectedDateKey = toDateKey(selectedDate);
  const dayTaskCount = dueTaskCountsByDate[selectedDateKey] ?? 0;

  return (
    <div className="min-h-full bg-background px-6 pb-32 pt-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display-hero-mobile text-display-hero-mobile font-bold tracking-tight text-on-surface">Agenda</h1>
            <div className="inline-flex shrink-0 rounded-full bg-surface-container-low p-1" role="tablist" aria-label="Vista de agenda">
              <button
                aria-selected={view === "day"}
                className={cn("min-h-10 rounded-full px-4 font-body-md text-body-md transition-colors", view === "day" ? "bg-surface-container-lowest font-medium text-on-surface shadow-sm" : "text-on-surface-variant")}
                onClick={() => onViewChange("day")}
                role="tab"
                type="button"
              >
                Día
              </button>
              <button
                aria-selected={view === "week"}
                className={cn("min-h-10 rounded-full px-4 font-body-md text-body-md transition-colors", view === "week" ? "bg-surface-container-lowest font-medium text-on-surface shadow-sm" : "text-on-surface-variant")}
                onClick={() => onViewChange("week")}
                role="tab"
                type="button"
              >
                Semana
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 font-headline-sm text-headline-sm font-semibold leading-6 text-on-surface">
              <span className="inline min-[400px]:hidden">{formatCompactDate(selectedDate)}</span>
              <span className="hidden min-[400px]:inline">{formatDate(selectedDate)}</span>
            </h2>
            <div className="flex shrink-0 items-center gap-0.5">
              <button aria-label="Día anterior" className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" onClick={onPreviousDay} type="button">
                <ChevronLeft size={21} />
              </button>
              <button className="rounded-full px-2.5 py-1.5 font-body-md text-body-md text-on-surface hover:bg-surface-container-low" onClick={onToday} type="button">Hoy</button>
              <button aria-label="Día siguiente" className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" onClick={onNextDay} type="button">
                <ChevronRight size={21} />
              </button>
            </div>
          </div>

          <DaySelector days={days} onSelect={onDateChange} selectedDate={selectedDate} />
        </header>

        {view === "day" ? (
          <MobileDayAgenda
            date={selectedDate}
            dayEndMin={dayEndMin}
            dayStartMin={dayStartMin}
            dayTaskCount={dayTaskCount}
            events={events}
            items={items}
            onBlockClick={(block, date) => onBlockClick(block, date)}
             onDayTasksClick={onDayTasksClick}
             onEventClick={onEventClick}
           />
        ) : (
          <MobileWeekAgenda
            blocks={blocks}
            days={days}
            events={events}
            exceptions={exceptions}
            onBlockClick={(block, date) => onBlockClick(block, date)}
            onDateChange={onDateChange}
             onEventClick={onEventClick}
            onDayTasksClick={onDayTasksClick}
            projects={projects}
            selectedDate={selectedDate}
            dueTaskCountsByDate={dueTaskCountsByDate}
          />
        )}
      </div>

      <FAB ariaLabel="Nuevo bloque" onClick={onAdd} />
    </div>
  );
}
