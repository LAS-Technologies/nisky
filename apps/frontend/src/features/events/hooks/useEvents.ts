import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, EventExceptionPayload, type CalendarEventUpdatePayload } from "../api/events";

export function useEventsQuery(from: string, to: string) {
  return useQuery({
    queryKey: ["events", from, to],
    queryFn: () => eventsApi.getEvents(from, to),
  });
}

export function useTodayEventsQuery() {
  return useQuery({
    queryKey: ["events", "today"],
    queryFn: () => eventsApi.getTodayEvents(),
    refetchInterval: 60_000,
  });
}

export function useEventExceptionsQuery(eventId: string) {
  return useQuery({
    queryKey: ["event-exceptions", eventId],
    queryFn: () => eventsApi.getEventExceptions(eventId),
    enabled: Boolean(eventId),
  });
}

export function useEventMutations() {
  const queryClient = useQueryClient();

  const invalidateEvents = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["event-exceptions"] }),
      queryClient.invalidateQueries({ queryKey: ["home"] }),
    ]);
  };

  const createEvent = useMutation({
    mutationFn: eventsApi.createEvent,
    onSuccess: invalidateEvents,
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CalendarEventUpdatePayload }) =>
      eventsApi.updateEvent(id, payload),
    onSuccess: invalidateEvents,
  });

  const deleteEvent = useMutation({
    mutationFn: eventsApi.deleteEvent,
    onSuccess: invalidateEvents,
  });

  const createException = useMutation({
    mutationFn: ({ eventId, payload }: { eventId: string; payload: EventExceptionPayload }) =>
      eventsApi.createEventException(eventId, payload),
    onSuccess: invalidateEvents,
  });

  const deleteException = useMutation({
    mutationFn: ({ eventId, exceptionId }: { eventId: string; exceptionId: string }) =>
      eventsApi.deleteEventException(eventId, exceptionId),
    onSuccess: invalidateEvents,
  });

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    createException,
    deleteException,
  };
}
