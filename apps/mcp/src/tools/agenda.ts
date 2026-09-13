import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { nisky, toolResult } from "../client";

function isCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const calendarDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD")
  .refine(isCalendarDate, "La fecha no es válida");
const taskStatus = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
const MAX_SCHEDULE_RANGE_MS = 30 * 86_400_000;

export function registerAgendaTools(server: McpServer, auth: string) {
  server.registerTool(
    "get-home-overview",
    {
      title: "Resumen del día",
      description: "Obtiene el resumen del día: tareas, bloques, evento activo, urgentes y progreso semanal.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await nisky(auth, "/home/overview");
      return toolResult(result);
    },
  );

  server.registerTool(
    "list-task-schedule",
    {
      title: "Listar agenda de tareas",
      description: "Lista las tareas asignadas a bloques dentro de un intervalo de hasta 31 días.",
      inputSchema: z
        .object({
          from: calendarDate,
          to: calendarDate,
          projectId: z.uuid().optional(),
          status: taskStatus.optional(),
        })
        .refine((value) => value.from <= value.to, {
          message: "El intervalo de fechas no es válido",
          path: ["to"],
        })
        .refine(
          (value) => Date.parse(`${value.to}T00:00:00.000Z`) - Date.parse(`${value.from}T00:00:00.000Z`) <= MAX_SCHEDULE_RANGE_MS,
          {
            message: "El intervalo no puede superar 31 días",
            path: ["to"],
          },
        ),
    },
    async (args) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined) query.set(key, String(value));
      }
      const result = await nisky(auth, `/task-schedules?${query.toString()}`);
      return toolResult(result);
    },
  );

  server.registerTool(
    "list-events",
    {
      title: "Listar eventos",
      description: "Lista los eventos del calendario dentro de un intervalo, incluyendo recurrencias y excepciones.",
      inputSchema: z
        .object({
          from: calendarDate,
          to: calendarDate,
        })
        .refine((value) => value.from <= value.to, {
          message: "El intervalo de fechas no es válido",
          path: ["to"],
        })
        .refine(
          (value) => Date.parse(`${value.to}T00:00:00.000Z`) - Date.parse(`${value.from}T00:00:00.000Z`) <= MAX_SCHEDULE_RANGE_MS,
          {
            message: "El intervalo no puede superar 31 días",
            path: ["to"],
          },
        ),
    },
    async ({ from, to }) => {
      const result = await nisky(auth, `/events?from=${encodeURIComponent(`${from}T00:00:00.000Z`)}&to=${encodeURIComponent(`${to}T23:59:59.999Z`)}`);
      return toolResult(result);
    },
  );

  server.registerTool(
    "schedule-task",
    {
      title: "Programar tarea",
      description: "Asigna una tarea a un bloque de tiempo en una fecha concreta.",
      inputSchema: z.object({
        taskId: z.uuid(),
        date: calendarDate,
        timeBlockId: z.uuid(),
        order: z.number().int().min(0).max(10000).optional(),
      }),
    },
    async ({ taskId, ...body }) => {
      const result = await nisky(auth, `/task-schedules/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return toolResult(result);
    },
  );
}
