"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, MoreVertical } from "lucide-react";
import type { CalendarEvent, Project, TimeBlock, TimeBlockException } from "@/types/entities";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT, DAY_ORDER, hexToRgba, minToTime, parseDateOnly, toDateKey } from "../lib/time";
import { blockOccurrenceOn, findTimeBlockException, sameLocalDay } from "../lib/occurrences";

const HOUR_PX = 56;
const MIN_DURATION = 15;
const EDGE = 48;
const EDGE_STEP = 24;
const MOVE_THRESHOLD = 8;

function monday(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

type DayColumn = { el: HTMLElement; dayOfWeek: number };

function columnAtX(columns: DayColumn[], x: number) {
  const containing = columns.find((column) => {
    const rect = column.el.getBoundingClientRect();
    return x >= rect.left && x <= rect.right;
  });
  if (containing) return containing;

  return columns.reduce<DayColumn | undefined>((closest, column) => {
    if (!closest) return column;
    const columnCenter = (column.el.getBoundingClientRect().left + column.el.getBoundingClientRect().right) / 2;
    const closestCenter = (closest.el.getBoundingClientRect().left + closest.el.getBoundingClientRect().right) / 2;
    return Math.abs(x - columnCenter) < Math.abs(x - closestCenter) ? column : closest;
  }, undefined);
}

function timesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function dayConflicts(block: TimeBlock, event: CalendarEvent) {
  if (event.allDay || event.startMin === null || event.endMin === null) return false;
  return timesOverlap(block.startMin, block.endMin, event.startMin, event.endMin);
}

type ResizeDraft = {
  block: TimeBlock;
  kind: "start" | "end" | "move";
  startMin: number;
  endMin: number;
  baseStartMin: number;
  baseEndMin: number;
  days: number[];
  dragDay: number;
  sourceDate: string;
  draggedDate: string;
  durationMin: number;
  columns: DayColumn[];
  container: HTMLElement;
  grid: HTMLElement;
  left: number;
  width: number;
  headerOffset: number;
};

type EventDragKind = "event-move" | "event-start" | "event-end";

type EventDragDraft = {
  event: CalendarEvent;
  kind: EventDragKind;
  startMin: number;
  endMin: number;
  baseStartMin: number;
  baseEndMin: number;
  dragDay: number;
  sourceDate: string;
  draggedDate: string;
  durationMin: number;
  pointerOffsetPx: number;
  allowDayChange: boolean;
  columns: DayColumn[];
  container: HTMLElement;
  grid: HTMLElement;
  left: number;
  width: number;
  headerOffset: number;
};

type AllDayEventDragDraft = {
  event: CalendarEvent;
  kind: "event-day-move";
  dragDay: number;
  sourceDate: string;
  draggedDate: string;
  columns: DayColumn[];
  container: HTMLElement;
  grid: HTMLElement;
  left: number;
  width: number;
  top: number;
  height: number;
};

type DragDraft = ResizeDraft | EventDragDraft | AllDayEventDragDraft;

export function TimeBlockWeekGrid({
  blocks,
  projects,
  events = [],
  exceptions = [],
  onBlockClick,
  onSlotClick,
  onResize,
  onEventClick,
  onEventMove,
  onEventAction,
  dueTaskCountsByDate = {},
  onDayTasksClick,
  moveEnabled = true,
  dayStartMin = 6 * 60,
  dayEndMin = 23 * 60,
  weekStart,
}: {
  blocks: TimeBlock[];
  projects: Project[];
  events?: CalendarEvent[];
  exceptions?: TimeBlockException[];
  onBlockClick: (block: TimeBlock, date?: Date) => void;
  onSlotClick: (dayOfWeek: number, startMin: number, date: Date) => void;
  onResize: (
    block: TimeBlock,
    startMin: number,
    endMin: number,
    days: number[],
    draggedDate?: string,
    sourceDate?: string,
  ) => void;
  onEventClick?: (event: CalendarEvent, date: Date) => void;
  onEventMove?: (
    event: CalendarEvent,
    sourceDate: Date,
    targetDate: Date,
    startMin: number | null,
    endMin: number | null,
  ) => void;
  onEventAction?: (event: CalendarEvent, date: Date, action: "skip" | "move") => void;
  dueTaskCountsByDate?: Record<string, number>;
  onDayTasksClick?: (date: string) => void;
  moveEnabled?: boolean;
  dayStartMin?: number;
  dayEndMin?: number;
  weekStart?: Date;
}) {
  const totalMin = Math.max(dayEndMin - dayStartMin, 60);
  const totalPx = (totalMin * HOUR_PX) / 60;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DragDraft | null>(null);
  const draftRef = useRef<DragDraft | null>(null);
  const [eventMenu, setEventMenu] = useState<{ eventId: string; date: Date } | null>(null);

  useEffect(() => {
    if (!eventMenu) return;
    const close = () => setEventMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [eventMenu]);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const blockDownRef = useRef(false);
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const onResizeRef = useRef(onResize);
  const onBlockClickRef = useRef(onBlockClick);
  const onEventClickRef = useRef(onEventClick);
  const onEventMoveRef = useRef(onEventMove);
  useEffect(() => {
    onResizeRef.current = onResize;
    onBlockClickRef.current = onBlockClick;
    onEventClickRef.current = onEventClick;
    onEventMoveRef.current = onEventMove;
  });
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayKey = toDateKey(now);
  const gridWeekStart = weekStart ?? monday(now);
  const days = DAY_ORDER.map((dayOfWeek, index) => {
    const date = new Date(gridWeekStart);
    date.setDate(date.getDate() + index);
    return {
      dayOfWeek,
      date,
      key: toDateKey(date),
    };
  });
  const hourMarks = Array.from(
    { length: Math.floor((dayEndMin - dayStartMin) / 60) },
    (_, index) => dayStartMin + (index + 1) * 60,
  );
  const [initialScrollTop] = useState(() =>
    Math.max(((nowMin - (dayStartMin + 4 * 60)) * HOUR_PX) / 60, 0),
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = initialScrollTop;
    const todayColumn = el.querySelector<HTMLElement>("[data-today='true']");
    if (!todayColumn) return;
    const containerRect = el.getBoundingClientRect();
    const columnRect = todayColumn.getBoundingClientRect();
    const maxScroll = Math.max(el.scrollWidth - el.clientWidth, 0);
    const target =
      el.scrollLeft +
      (columnRect.left - containerRect.left) -
      (el.clientWidth - columnRect.width) / 2;
    el.scrollLeft = Math.min(Math.max(target, 0), maxScroll);
  }, [initialScrollTop]);

  const clickSlot = (
    event: React.MouseEvent<HTMLDivElement>,
    dayOfWeek: number,
  ) => {
    if (blockDownRef.current) return;
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minute = dayStartMin + ((event.clientY - rect.top) / HOUR_PX) * 60;
    onSlotClick(dayOfWeek, Math.round(minute / 15) * 15, days.find((day) => day.dayOfWeek === dayOfWeek)?.date ?? new Date());
  };

  const getColumns = (grid: HTMLElement): DayColumn[] =>
    Array.from(grid.querySelectorAll<HTMLElement>("[data-resize-col]")).map(
      (el) => ({
        el,
        dayOfWeek: Number(el.getAttribute("data-day")),
      }),
    );

  const stopAutoscroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const scrollTick = useCallback(() => {
    rafRef.current = null;
    const state = draftRef.current;
    const pos = pointerPosRef.current;
    if (!state || !pos) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const rect = state.container.getBoundingClientRect();
    const speed = (overshoot: number) =>
      Math.min(EDGE_STEP + Math.abs(overshoot) * 2, 80);
    const overTop = Math.max(rect.top + EDGE - pos.y, EDGE - pos.y);
    const overBottom = Math.max(
      pos.y - (rect.bottom - EDGE),
      pos.y - (vh - EDGE),
    );
    const overLeft = Math.max(rect.left + EDGE - pos.x, EDGE - pos.x);
    const overRight = Math.max(
      pos.x - (rect.right - EDGE),
      pos.x - (vw - EDGE),
    );
    let dx = 0;
    let dy = 0;
    if (overTop > 0) dy = -speed(overTop);
    else if (overBottom > 0) dy = speed(overBottom);
    if (overLeft > 0) dx = -speed(overLeft);
    else if (overRight > 0) dx = speed(overRight);
    if (dx !== 0 || dy !== 0) {
      state.container.scrollTop += dy;
      state.container.scrollLeft += dx;
    }
    rafRef.current = requestAnimationFrame(scrollTick);
  }, []);

  const moveHandle = useCallback(
    (event: PointerEvent) => {
      const state = draftRef.current;
      if (!state) return;
      const down = downRef.current;
      if (!movedRef.current && down) {
        const dx = event.clientX - down.x;
        const dy = event.clientY - down.y;
        if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
          movedRef.current = true;
          rafRef.current = requestAnimationFrame(scrollTick);
        }
      }
      if (!movedRef.current) return;
      event.preventDefault();
      pointerPosRef.current = { x: event.clientX, y: event.clientY };

      let colRect: DOMRect | null = null;
      let dragDay = state.dragDay;
      if (state.kind === "move" || (state.kind === "event-move" && state.allowDayChange) || state.kind === "event-day-move") {
        const column = columnAtX(state.columns, event.clientX);
        if (column) {
          dragDay = column.dayOfWeek;
          colRect = column.el.getBoundingClientRect();
        }
      } else {
        const own = state.columns.find(
          (column) => column.dayOfWeek === dragDay,
        );
        if (own) colRect = own.el.getBoundingClientRect();
      }
      if (!colRect) return;
      if (state.kind === "event-day-move") {
        const draggedDate = days.find((day) => day.dayOfWeek === dragDay)?.date;
        const next: AllDayEventDragDraft = {
          ...state,
          dragDay,
          draggedDate: draggedDate ? toDateKey(draggedDate) : state.draggedDate,
          left: colRect.left - state.grid.getBoundingClientRect().left + 4,
          width: colRect.width - 8,
        };
        draftRef.current = next;
        setDraft(next);
        return;
      }
      const minute =
        Math.round(
          (dayStartMin + ((event.clientY - colRect.top - (state.kind === "event-move" ? state.pointerOffsetPx : 0)) / HOUR_PX) * 60) / 15,
        ) * 15;
      const clamped = Math.min(Math.max(minute, dayStartMin), dayEndMin);
      let next: DragDraft = state;
      if (state.kind === "move") {
        const startMin = Math.min(
          Math.max(clamped, dayStartMin),
          dayEndMin - state.durationMin,
        );
        next = {
          ...state,
          startMin,
          endMin: startMin + state.durationMin,
          days: state.block.daysOfWeek.map(
            (day) => (day - state.dragDay + dragDay + 7) % 7,
          ),
          left: colRect.left - state.grid.getBoundingClientRect().left + 4,
          width: colRect.width - 8,
        };
      } else if (state.kind === "event-move") {
        const startMin = Math.min(
          Math.max(clamped, dayStartMin),
          dayEndMin - state.durationMin,
        );
        const draggedDate = days.find((day) => day.dayOfWeek === dragDay)?.date;
        next = {
          ...state,
          startMin,
          endMin: startMin + state.durationMin,
          dragDay,
          draggedDate: draggedDate ? toDateKey(draggedDate) : state.draggedDate,
          left: colRect.left - state.grid.getBoundingClientRect().left + 4,
          width: colRect.width - 8,
        };
      } else if (state.kind === "event-start") {
        next = { ...state, startMin: Math.min(clamped, state.endMin - MIN_DURATION) };
      } else if (state.kind === "event-end") {
        next = { ...state, endMin: Math.max(clamped, state.startMin + MIN_DURATION) };
      } else if (state.kind === "start") {
        next = { ...state, startMin: Math.min(clamped, state.endMin - MIN_DURATION) };
      } else if (state.kind === "end") {
        next = { ...state, endMin: Math.max(clamped, state.startMin + MIN_DURATION) };
      }
      draftRef.current = next;
      setDraft(next);
    },
    [dayStartMin, dayEndMin, days, scrollTick],
  );

  const endResize = useCallback(
    function endResize() {
      stopAutoscroll();
      pointerPosRef.current = null;
      const state = draftRef.current;
      draftRef.current = null;
      downRef.current = null;
      setDraft(null);
      window.removeEventListener("pointermove", moveHandle);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
      if (!state) return;
      if ("event" in state) {
        if (state.kind === "event-day-move") {
          if (state.draggedDate !== state.sourceDate) {
            onEventMoveRef.current?.(
              state.event,
              parseDateOnly(state.sourceDate),
              parseDateOnly(state.draggedDate),
              null,
              null,
            );
          } else if (!movedRef.current) {
            onEventClickRef.current?.(state.event, parseDateOnly(state.sourceDate));
          }
          return;
        }
        const changed =
          state.startMin !== state.baseStartMin ||
          state.endMin !== state.baseEndMin ||
          state.draggedDate !== state.sourceDate;
        if (changed) {
          onEventMoveRef.current?.(
            state.event,
            parseDateOnly(state.sourceDate),
            parseDateOnly(state.draggedDate),
            state.startMin,
            state.endMin,
          );
        } else if (!movedRef.current) {
          onEventClickRef.current?.(state.event, parseDateOnly(state.sourceDate));
        }
        return;
      }
      const daysChanged =
        state.days.length !== state.block.daysOfWeek.length ||
        state.days.some((day, index) => day !== state.block.daysOfWeek[index]);
      const changed =
        state.startMin !== state.baseStartMin ||
        state.endMin !== state.baseEndMin ||
        daysChanged;
      if (changed) {
        onResizeRef.current(
          state.block,
          state.startMin,
          state.endMin,
          state.days,
          state.draggedDate,
          state.sourceDate,
        );
      } else if (!movedRef.current) {
        onBlockClickRef.current(
          state.block,
          state.draggedDate ? parseDateOnly(state.draggedDate) : undefined,
        );
      }
    },
    [moveHandle, stopAutoscroll],
  );

  const attachWindowListeners = useCallback(() => {
    window.addEventListener("pointermove", moveHandle);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  }, [moveHandle, endResize]);

  const startResize = (
    event: React.PointerEvent<HTMLDivElement>,
    block: TimeBlock,
    edge: "start" | "end",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const grid = event.currentTarget.closest<HTMLElement>("[data-grid]");
    const container = scrollRef.current;
    if (!grid || !container) return;
    const columns = getColumns(grid);
    const column =
      event.currentTarget.closest<HTMLElement>("[data-resize-col]");
    const dragDay = column
      ? Number(column.getAttribute("data-day"))
      : block.daysOfWeek[0];
    const ownColumn = columns.find((item) => item.dayOfWeek === dragDay);
    const gridRect = grid.getBoundingClientRect();
    const colRect = ownColumn?.el.getBoundingClientRect();
    const dragDateObj = days.find((d) => d.dayOfWeek === dragDay)?.date;
    const draggedDate = dragDateObj 
      ? `${dragDateObj.getFullYear()}-${String(dragDateObj.getMonth() + 1).padStart(2, "0")}-${String(dragDateObj.getDate()).padStart(2, "0")}`
      : "";
    const dragException = dragDateObj
      ? findTimeBlockException(block, dragDateObj, exceptions)
      : undefined;
    const movedException = dragDateObj
      ? exceptions.find(
        (exception) => exception.blockId === block.id
          && exception.action === "move"
          && exception.targetDate
          && sameLocalDay(parseDateOnly(exception.targetDate), dragDateObj),
      )
      : undefined;
    const activeException = dragException ?? movedException;
    const baseStartMin =
      activeException?.action === "move" && activeException.startMin !== null
        ? activeException.startMin
        : block.startMin;
    const baseEndMin =
      activeException?.action === "move" && activeException.endMin !== null
        ? activeException.endMin
        : block.endMin;
    blockDownRef.current = true;
    downRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    pointerPosRef.current = { x: event.clientX, y: event.clientY };
    draftRef.current = {
      block,
      kind: edge,
      startMin: baseStartMin,
      endMin: baseEndMin,
      baseStartMin,
      baseEndMin,
      days: [...block.daysOfWeek],
      dragDay,
      draggedDate,
      durationMin: baseEndMin - baseStartMin,
      columns,
      container,
      grid,
      left: colRect ? colRect.left - gridRect.left + 4 : 0,
      width: colRect ? colRect.width - 8 : 0,
      headerOffset: colRect ? colRect.top - gridRect.top : 0,
      sourceDate: activeException?.action === "move" ? toDateKey(parseDateOnly(activeException.date)) : draggedDate,
    };
    setDraft(draftRef.current);
    attachWindowListeners();
  };

  const startMove = (
    event: React.PointerEvent<HTMLButtonElement>,
    block: TimeBlock,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!moveEnabled) return;
    const grid = event.currentTarget.closest<HTMLElement>("[data-grid]");
    const column =
      event.currentTarget.closest<HTMLElement>("[data-resize-col]");
    const container = scrollRef.current;
    if (!grid || !column || !container) return;
    const dragDay = Number(column.getAttribute("data-day"));
    const columns = getColumns(grid);
    const gridRect = grid.getBoundingClientRect();
    const colRect = column.getBoundingClientRect();
    const dragDateObj = days.find((d) => d.dayOfWeek === dragDay)?.date;
    const draggedDate = dragDateObj 
      ? `${dragDateObj.getFullYear()}-${String(dragDateObj.getMonth() + 1).padStart(2, "0")}-${String(dragDateObj.getDate()).padStart(2, "0")}`
      : "";
    const dragException = dragDateObj
      ? findTimeBlockException(block, dragDateObj, exceptions)
      : undefined;
    const movedException = dragDateObj
      ? exceptions.find(
        (exception) => exception.blockId === block.id
          && exception.action === "move"
          && exception.targetDate
          && sameLocalDay(parseDateOnly(exception.targetDate), dragDateObj),
      )
      : undefined;
    const activeException = dragException ?? movedException;
    const baseStartMin =
      activeException?.action === "move" && activeException.startMin !== null
        ? activeException.startMin
        : block.startMin;
    const baseEndMin =
      activeException?.action === "move" && activeException.endMin !== null
        ? activeException.endMin
        : block.endMin;
    blockDownRef.current = true;
    downRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    pointerPosRef.current = { x: event.clientX, y: event.clientY };
    draftRef.current = {
      block,
      kind: "move",
      startMin: baseStartMin,
      endMin: baseEndMin,
      baseStartMin,
      baseEndMin,
      days: [...block.daysOfWeek],
      dragDay,
      draggedDate,
      durationMin: baseEndMin - baseStartMin,
      columns,
      container,
      grid,
      left: colRect.left - gridRect.left + 4,
      width: colRect.width - 8,
      headerOffset: colRect.top - gridRect.top,
      sourceDate: activeException?.action === "move" ? toDateKey(parseDateOnly(activeException.date)) : draggedDate,
    };
    setDraft(draftRef.current);
    attachWindowListeners();
  };

  const startEventDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    calendarEvent: CalendarEvent,
    dayDate: Date,
    kind: EventDragKind,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!moveEnabled || calendarEvent.allDay || calendarEvent.startMin === null || calendarEvent.endMin === null) return;
    const grid = event.currentTarget.closest<HTMLElement>("[data-grid]");
    const container = scrollRef.current;
    if (!grid || !container) return;
    const columns = getColumns(grid);
    const dragDay = dayDate.getDay();
    const column = columns.find((item) => item.dayOfWeek === dragDay);
    if (!column) return;
    const gridRect = grid.getBoundingClientRect();
    const colRect = column.el.getBoundingClientRect();
    const sourceDate = toDateKey(dayDate);
    const baseStartMin = calendarEvent.startMin;
    const baseEndMin = calendarEvent.endMin;
    const eventTop = (Math.max(baseStartMin - dayStartMin, 0) * HOUR_PX) / 60;
    blockDownRef.current = true;
    downRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    pointerPosRef.current = { x: event.clientX, y: event.clientY };
    draftRef.current = {
      event: calendarEvent,
      kind,
      startMin: baseStartMin,
      endMin: baseEndMin,
      baseStartMin,
      baseEndMin,
      dragDay,
      sourceDate,
      draggedDate: sourceDate,
      durationMin: baseEndMin - baseStartMin,
      pointerOffsetPx: event.clientY - colRect.top - eventTop,
      allowDayChange: kind === "event-move",
      columns,
      container,
      grid,
      left: colRect.left - gridRect.left + 4,
      width: colRect.width - 8,
      headerOffset: colRect.top - gridRect.top,
    };
    setEventMenu(null);
    setDraft(draftRef.current);
    attachWindowListeners();
  };

  const startAllDayEventDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    calendarEvent: CalendarEvent,
    dayDate: Date,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!moveEnabled) return;
    const grid = event.currentTarget.closest<HTMLElement>("[data-grid]");
    const container = scrollRef.current;
    if (!grid || !container) return;
    const columns = getColumns(grid);
    const dragDay = dayDate.getDay();
    const column = columns.find((item) => item.dayOfWeek === dragDay);
    if (!column) return;
    const gridRect = grid.getBoundingClientRect();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const columnRect = column.el.getBoundingClientRect();
    const sourceDate = toDateKey(dayDate);
    blockDownRef.current = true;
    downRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    pointerPosRef.current = { x: event.clientX, y: event.clientY };
    draftRef.current = {
      event: calendarEvent,
      kind: "event-day-move",
      dragDay,
      sourceDate,
      draggedDate: sourceDate,
      columns,
      container,
      grid,
      left: columnRect.left - gridRect.left + 4,
      width: columnRect.width - 8,
      top: buttonRect.top - gridRect.top,
      height: buttonRect.height,
    };
    setDraft(draftRef.current);
    attachWindowListeners();
  };

  const renderBlockButton = (
    block: TimeBlock,
    startMin: number,
    endMin: number,
    hidden: boolean,
    conflict?: CalendarEvent,
    dayDate?: Date,
  ) => {
    const project = projects.find((item) => item.id === block.projectId);
    const color = project?.color ?? "#7a8494";
    const label = block.name ?? project?.name ?? "Tiempo libre";
    const top = (Math.max(startMin - dayStartMin, 0) * HOUR_PX) / 60;
    const bottom = (Math.min(endMin - dayStartMin, totalMin) * HOUR_PX) / 60;
    const height = Math.max(bottom - top, 12);
    const compact = height < 48;
    return (
      <button
        aria-label={
          hidden
            ? undefined
            : `${label}: ${minToTime(startMin)} a ${minToTime(endMin)}`
        }
        aria-hidden={hidden ? true : undefined}
        className={cn(
          "absolute inset-x-1 z-10 rounded-md border-l-2 px-2 py-1 text-left shadow-cadence-1 transition-shadow",
          moveEnabled
            ? "cursor-grab touch-none active:cursor-grabbing"
            : "cursor-pointer",
          block.isActive ? "hover:shadow-cadence-2" : "opacity-40",
          hidden && "opacity-0",
        )}
        key={block.id}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!moveEnabled || event.detail === 0) onBlockClick(block, dayDate);
        }}
        onPointerDown={
          moveEnabled ? (event) => startMove(event, block) : undefined
        }
        style={{
          top,
          height,
          backgroundColor: hexToRgba(color, 0.14),
          borderColor: color,
          ...(conflict ? { outline: "1px dashed var(--error)", outlineOffset: -3 } : {}),
        }}
        title={
          conflict
            ? `${label} · ${minToTime(startMin)}–${minToTime(endMin)} · ¡Choca con "${conflict.title}"!`
            : `${label} · ${minToTime(startMin)}–${minToTime(endMin)}${block.isActive ? "" : " · Pausado"}`
        }
        type="button"
      >
        {conflict && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-primary"
            title={`Choca con "${conflict.title}"`}
          >
            !
          </span>
        )}
        <p
          className={cn(
            "truncate font-body-sm text-body-sm font-semibold",
            compact && "leading-tight",
          )}
          style={{ color }}
        >
          {label}
        </p>
        {!compact && (
          <p className="truncate font-data-mono text-data-mono text-[10px] text-on-surface-variant">
            {minToTime(startMin)}–{minToTime(endMin)}
          </p>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-20 h-4 cursor-ns-resize touch-none lg:h-2"
          onPointerDown={(event) => startResize(event, block, "start")}
          title="Arrastra para cambiar el inicio"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-20 h-4 cursor-ns-resize touch-none lg:h-2"
          onPointerDown={(event) => startResize(event, block, "end")}
          title="Arrastra para cambiar el fin"
        />
      </button>
    );
  };

  const renderEventBlock = (
    event: CalendarEvent,
    conflict?: TimeBlock,
    dayDate?: Date,
    hidden = false,
    preview?: { left: number; width: number; top: number; height: number; startMin: number; endMin: number },
  ) => {
    if (event.allDay || event.startMin === null || event.endMin === null) return null;
    const eventColor = event.color ?? "#303e51";
    const startMin = preview?.startMin ?? event.startMin;
    const endMin = preview?.endMin ?? event.endMin;
    const top = preview?.top ?? (Math.max(startMin - dayStartMin, 0) * HOUR_PX) / 60;
    const bottom = (Math.min(endMin - dayStartMin, totalMin) * HOUR_PX) / 60;
    const height = preview?.height ?? Math.max(bottom - top, 12);
    const interactive = !hidden && !preview;
    const menuOpen = interactive && eventMenu?.eventId === event.id;
    return (
      <div
        key={`${event.id}-${dayDate ? toDateKey(dayDate) : "event"}`}
        className={cn(
          "absolute overflow-visible rounded-md border-l-2 px-2 py-1 text-left shadow-cadence-1",
          menuOpen ? "z-50" : "z-20",
          !preview && "inset-x-1",
          interactive && (moveEnabled ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"),
          preview && "pointer-events-none z-30",
          conflict && "border-l-error",
          hidden && "pointer-events-none opacity-0",
        )}
        onClick={interactive ? (pointerEvent) => {
          pointerEvent.preventDefault();
          pointerEvent.stopPropagation();
          if (!moveEnabled || pointerEvent.detail === 0) onEventClick?.(event, dayDate ?? new Date());
        } : undefined}
        onKeyDown={interactive ? (e) => {
          if ((e.key === "Enter" || e.key === " ") && onEventClick) {
            e.preventDefault();
            onEventClick(event, dayDate ?? new Date());
          }
        } : undefined}
        onPointerDown={
          interactive && moveEnabled && dayDate
            ? (pointerEvent) => startEventDrag(pointerEvent, event, dayDate, "event-move")
            : undefined
        }
        role={interactive && onEventClick ? "button" : undefined}
        style={{
          top,
          height,
          ...(preview ? { left: preview.left, width: preview.width } : {}),
          backgroundColor: hexToRgba(eventColor, 0.14),
          borderColor: conflict ? "var(--error)" : eventColor,
          ...(conflict ? { outline: "1px dashed var(--error)", outlineOffset: -3 } : {}),
        }}
        tabIndex={interactive && onEventClick ? 0 : undefined}
        title={conflict ? `${event.title} · ¡Choca con el bloque "${conflict.name ?? projects.find((p) => p.id === conflict.projectId)?.name ?? "Tiempo libre"}"!` : undefined}
      >
        <p className="truncate font-body-sm text-body-sm font-semibold leading-tight" style={{ color: eventColor }}>
          {event.title}
        </p>
        {event.location && (
          <p className="flex min-w-0 items-center gap-1 truncate font-data-mono text-[10px] leading-tight text-on-surface-variant/70">
            <MapPin aria-hidden="true" className="shrink-0" size={10} />
            <span className="truncate">{event.location}</span>
          </p>
        )}
        <p className="truncate font-data-mono text-[10px] leading-tight text-on-surface-variant">
          {minToTime(startMin)}–{minToTime(endMin)}
        </p>
        {!preview && dayDate && moveEnabled && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 z-20 h-3 cursor-ns-resize touch-none"
              onPointerDown={(pointerEvent) => startEventDrag(pointerEvent, event, dayDate, "event-start")}
              title="Arrastra para cambiar el inicio"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 z-20 h-3 cursor-ns-resize touch-none"
              onPointerDown={(pointerEvent) => startEventDrag(pointerEvent, event, dayDate, "event-end")}
              title="Arrastra para cambiar el fin"
            />
          </>
        )}
        {event.recurrenceType && dayDate && onEventAction && interactive && (
          <div
            className="absolute right-1 top-1 z-30"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Opciones del evento recurrente"
              className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high lg:h-6 lg:w-6"
              onClick={(e) => {
                e.stopPropagation();
                setEventMenu((m) => (m?.eventId === event.id ? null : { eventId: event.id, date: dayDate }));
              }}
              type="button"
            >
              <MoreVertical size={12} />
            </button>
            {menuOpen && (
               <div className="absolute right-0 top-11 z-40 flex w-40 flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-cadence-2 lg:top-6">
                <button
                   className="min-h-11 rounded-t-lg px-3 py-2 text-left font-body-sm text-body-sm text-on-surface transition-colors hover:bg-surface-container-low lg:min-h-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEventMenu(null);
                    onEventAction(event, dayDate, "skip");
                  }}
                  type="button"
                >
                  Saltar solo hoy
                </button>
                <button
                   className="min-h-11 rounded-b-lg border-t border-outline-variant px-3 py-2 text-left font-body-sm text-body-sm text-on-surface transition-colors hover:bg-surface-container-low lg:min-h-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEventMenu(null);
                    onEventAction(event, dayDate, "move");
                  }}
                  type="button"
                >
                   Mover...
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const blockDraft = draft && "block" in draft ? draft : null;
  const eventDraft = draft && "event" in draft ? draft : null;
  const timedEventDraft = eventDraft?.kind !== "event-day-move" ? eventDraft : null;
  const allDayEventDraft = eventDraft?.kind === "event-day-move" ? eventDraft : null;
  const draftProject = blockDraft
    ? projects.find((item) => item.id === blockDraft.block.projectId)
    : null;
  const draftColor = draftProject?.color ?? "#7a8494";
  const draftLabel = blockDraft
    ? (blockDraft.block.name ?? draftProject?.name ?? "Tiempo libre")
    : "";
  const draftTop = blockDraft
    ? blockDraft.headerOffset + (Math.max(blockDraft.startMin - dayStartMin, 0) * HOUR_PX) / 60
    : 0;
  const draftBottom = blockDraft
    ? blockDraft.headerOffset + (Math.min(blockDraft.endMin - dayStartMin, totalMin) * HOUR_PX) / 60
    : 0;
  const draftHeight = blockDraft ? Math.max(draftBottom - draftTop, 12) : 0;
  const eventDraftTop = timedEventDraft
    ? timedEventDraft.headerOffset + (Math.max(timedEventDraft.startMin - dayStartMin, 0) * HOUR_PX) / 60
    : 0;
  const eventDraftBottom = timedEventDraft
    ? timedEventDraft.headerOffset + (Math.min(timedEventDraft.endMin - dayStartMin, totalMin) * HOUR_PX) / 60
    : 0;
  const eventDraftHeight = timedEventDraft ? Math.max(eventDraftBottom - eventDraftTop, 12) : 0;

  return (
    <div className={cn("flex min-w-0 flex-col", draft && "select-none")}>
      <div
        ref={scrollRef}
        className="max-h-[calc(100dvh-16rem)] overflow-auto bg-surface lg:max-h-[calc(100vh-15rem)]"
      >
        <div className="min-w-[820px] pb-3 pr-3">
          <div
            data-grid
            className="relative grid grid-cols-[3rem_repeat(7,minmax(110px,1fr))]"
          >
            <div
              aria-hidden="true"
              className="sticky left-0 top-0 z-50 border-r border-b border-outline-variant bg-surface-container-low"
            />
            {days.map((day) => {
              const dueTaskCount = dueTaskCountsByDate[toDateKey(day.date)] ?? 0;
              const dueTaskLabel = dueTaskCount === 1 ? "1 vence" : `${dueTaskCount} vencen`;
              return (
                <div
                  className={cn(
                    "sticky top-0 z-40 border-b bg-surface-container-low px-2 py-2 text-center",
                    day.key === todayKey
                      ? "border-t-2 border-t-secondary text-secondary"
                      : "border-t border-t-outline-variant text-on-surface-variant",
                  )}
                  data-day={day.dayOfWeek}
                  data-day-header
                  key={day.key}
                >
                  <span
                    className={cn(
                      "flex flex-col items-center rounded-md py-1",
                      day.key === todayKey && "bg-surface-container-low",
                    )}
                  >
                    <p className="font-data-mono text-data-mono text-xs font-semibold">
                      {DAY_NAMES_SHORT[day.dayOfWeek]}
                    </p>
                    <p className="mt-0.5 font-data-mono text-data-mono text-xs">
                      {day.date.getDate()}
                    </p>
                  </span>
                  {onDayTasksClick && dueTaskCount > 0 && (
                    <button
                      aria-label={`Ver ${dueTaskCount} ${dueTaskCount === 1 ? "tarea con vencimiento" : "tareas con vencimiento"}`}
                      className="mx-auto mt-1 inline-flex max-w-full items-center truncate rounded-full bg-primary-container px-2 py-0.5 font-label-caps text-[10px] uppercase text-on-primary transition-colors hover:bg-primary-container/80"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDayTasksClick(toDateKey(day.date));
                      }}
                      title="Ver tareas con vencimiento"
                      type="button"
                    >
                      {dueTaskLabel}
                    </button>
                  )}
                  <div className="mt-1 flex flex-col gap-1">
                    {events
                      .filter((e) => e.allDay && sameLocalDay(parseDateOnly(e.date), day.date))
                      .map((e) => {
                        const hidden =
                          allDayEventDraft?.event.id === e.id &&
                          allDayEventDraft.sourceDate === day.key;
                        return (
                          <button
                            className={cn(
                              "block w-full truncate rounded-full bg-surface-container-high px-2 text-left text-[10px] font-medium text-on-surface transition-colors hover:bg-surface-container-highest",
                              moveEnabled && "cursor-grab touch-none active:cursor-grabbing",
                              hidden && "pointer-events-none opacity-0",
                            )}
                            key={e.id}
                            onClick={(clickEvent) => {
                              if (clickEvent.detail === 0 || !movedRef.current) onEventClick?.(e, day.date);
                            }}
                            onPointerDown={
                              moveEnabled
                                ? (pointerEvent) => startAllDayEventDrag(pointerEvent, e, day.date)
                                : undefined
                            }
                            title={e.title}
                            type="button"
                          >
                            {e.title}
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })}
            <div
              className="sticky left-0 z-20 border-r border-outline-variant bg-surface-container-low"
              style={{ height: totalPx }}
            >
              {hourMarks.map((hour) => (
                <span
                  className="absolute right-2 -translate-y-1/2 font-data-mono text-data-mono text-[11px] text-on-surface-variant"
                  key={hour}
                  style={{ top: ((hour - dayStartMin) * HOUR_PX) / 60 }}
                >
                  {minToTime(hour)}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const dayBlocks = blocks
                .filter((block) => blockOccurrenceOn(block, day.date, exceptions) !== null)
                 .sort((a, b) => a.startMin - b.startMin);
              const dayEvents = events.filter(
                (e) => sameLocalDay(parseDateOnly(e.date), day.date),
              );
              const isToday = day.key === todayKey;
              return (
                <div
                  className={cn(
                    "relative cursor-pointer border-l border-outline-variant transition-colors hover:bg-surface-container-low",
                    isToday && "bg-secondary-container/15",
                  )}
                  data-day={day.dayOfWeek}
                  data-resize-col
                  data-today={isToday ? "true" : undefined}
                  key={day.key}
                  onClick={(event) => clickSlot(event, day.dayOfWeek)}
                  onPointerDown={() => {
                    blockDownRef.current = false;
                  }}
                  style={{ height: totalPx }}
                >
                  {dayBlocks.map((block) => {
                    const occurrence = blockOccurrenceOn(block, day.date, exceptions);
                    if (!occurrence) return null;
                    const startMin = occurrence.startMin;
                    const endMin = occurrence.endMin;
                    const conflict = dayEvents.find(
                      (event) => dayConflicts({ ...block, startMin, endMin }, event),
                    );
                     const hidden =
                       blockDraft?.block.id === block.id && blockDraft.dragDay === day.dayOfWeek;
                    return renderBlockButton(
                      block,
                      startMin,
                      endMin,
                      hidden,
                      conflict,
                      day.date,
                    );
                  })}
                  {dayEvents
                    .filter((e) => !e.allDay && e.startMin !== null && e.endMin !== null)
                    .map((e) => {
                    const conflict = dayBlocks.find((block) => {
                      const occurrence = blockOccurrenceOn(block, day.date, exceptions);
                      if (!occurrence) return false;
                      return dayConflicts({ ...block, startMin: occurrence.startMin, endMin: occurrence.endMin }, e);
                    });
                    const hidden =
                      eventDraft?.event.id === e.id &&
                      eventDraft.sourceDate === toDateKey(day.date);
                    return renderEventBlock(e, conflict, day.date, hidden);
                    })}
                  {isToday && nowMin >= dayStartMin && nowMin <= dayEndMin && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-[15]"
                      style={{ top: ((nowMin - dayStartMin) * HOUR_PX) / 60 }}
                    >
                      <div className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-error" />
                      <div className="h-px w-full bg-error" />
                    </div>
                  )}
                </div>
              );
            })}
            {blockDraft && (
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute z-30 rounded-md border-l-2 px-2 py-1 text-left shadow-cadence-1 transition-shadow",
                  !blockDraft.block.isActive && "opacity-40",
                )}
                style={{
                  left: blockDraft.left,
                  width: blockDraft.width,
                  top: draftTop,
                  height: draftHeight,
                  backgroundColor: hexToRgba(draftColor, 0.14),
                  borderColor: draftColor,
                }}
              >
                <p
                  className={cn(
                    "truncate font-body-sm text-body-sm font-semibold",
                    draftHeight < 48 && "leading-tight",
                  )}
                  style={{ color: draftColor }}
                  >
                  {draftLabel}
                </p>
                <p className="truncate font-data-mono text-data-mono text-[10px] text-on-surface-variant">
                  {minToTime(blockDraft.startMin)}–{minToTime(blockDraft.endMin)}
                </p>
              </div>
            )}
            {timedEventDraft && renderEventBlock(
              timedEventDraft.event,
              undefined,
              parseDateOnly(timedEventDraft.draggedDate),
              false,
              {
                left: timedEventDraft.left,
                width: timedEventDraft.width,
                top: eventDraftTop,
                height: eventDraftHeight,
                startMin: timedEventDraft.startMin,
                endMin: timedEventDraft.endMin,
              },
            )}
            {allDayEventDraft && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-50 truncate rounded-full border border-outline-variant px-2 py-0.5 text-left text-[10px] font-medium text-on-surface shadow-cadence-1"
                style={{
                  left: allDayEventDraft.left,
                  width: allDayEventDraft.width,
                  top: allDayEventDraft.top,
                  height: allDayEventDraft.height,
                  backgroundColor: "var(--surface-container-high)",
                }}
              >
                {allDayEventDraft.event.title}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
