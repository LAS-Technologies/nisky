import { api } from "@/lib/api";
import { CalendarEvent, CalendarEventException, EventRecurrenceType } from "@/types/entities";

export interface CalendarEventPayload {
  title: string;
  date: string;
  allDay: boolean;
  startMin?: number;
  endMin?: number;
  location?: string;
  color?: string;
  recurrenceType?: EventRecurrenceType | null;
  recurrenceInterval?: number;
  recurrenceDaysOfWeek?: number[];
  recurrenceDayOfMonth?: number | null;
  recurrenceEndsAt?: string | null;
  remindBeforeMin?: number;
}

export interface CalendarEventUpdatePayload extends Partial<CalendarEventPayload> {
  effectiveFrom?: string;
}

export interface EventExceptionPayload {
  date: string;
  targetDate?: string | null;
  action: "skip" | "move";
  startMin?: number;
  endMin?: number;
}

export const eventsApi = {
  getEvents: async (from: string, to: string) => {
    const res = await api.get<{ data: CalendarEvent[] }>("/events", { params: { from, to } });
    return res.data.data;
  },

  getTodayEvents: async () => {
    const res = await api.get<{ data: CalendarEvent[] }>("/events/today");
    return res.data.data;
  },

  createEvent: async (payload: CalendarEventPayload) => {
    const res = await api.post<{ data: CalendarEvent }>("/events", payload);
    return res.data.data;
  },

  updateEvent: async (id: string, payload: CalendarEventUpdatePayload) => {
    const res = await api.patch<{ data: CalendarEvent }>(`/events/${id}`, payload);
    return res.data.data;
  },

  deleteEvent: async (id: string) => {
    const res = await api.delete<{ data: { success: true } }>(`/events/${id}`);
    return res.data.data;
  },

  getEventExceptions: async (eventId: string) => {
    const res = await api.get<{ data: CalendarEventException[] }>(`/events/${eventId}/exceptions`);
    return res.data.data;
  },

  createEventException: async (eventId: string, payload: EventExceptionPayload) => {
    const res = await api.post<{ data: CalendarEventException }>(`/events/${eventId}/exceptions`, payload);
    return res.data.data;
  },

  deleteEventException: async (eventId: string, exceptionId: string) => {
    const res = await api.delete<{ data: { success: true } }>(`/events/${eventId}/exceptions/${exceptionId}`);
    return res.data.data;
  },
};
