import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid("El identificador no es válido"),
});

const dateValue = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "La fecha no es válida");
const allDayValue = z.boolean();
const recurrenceIntervalValue = z.number().int().min(1).max(365);
const recurrenceDaysOfWeekValue = z.array(z.number().int().min(0).max(6));
const remindBeforeMinValue = z.number().int().min(0).max(10080);

const eventBaseFields = {
  title: z.string().trim().min(1, "El título es requerido").max(200, "Máximo 200 caracteres"),
  date: dateValue,
  allDay: allDayValue.default(false),
  startMin: z.number().int().min(0).max(1439).optional(),
  endMin: z.number().int().min(1).max(1440).optional(),
  location: z.string().trim().max(200).optional(),
  color: z.string().trim().max(20).optional(),
  recurrenceType: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).nullable().optional(),
  recurrenceInterval: recurrenceIntervalValue.default(1),
  recurrenceDaysOfWeek: recurrenceDaysOfWeekValue.default([]),
  recurrenceDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  recurrenceEndsAt: dateValue.nullable().optional(),
  remindBeforeMin: remindBeforeMinValue.default(0),
};

export const createEventSchema = z.object(eventBaseFields).superRefine((v, ctx) => {
  if (!v.allDay) {
    if (v.startMin === undefined) {
      ctx.addIssue({ code: "custom", path: ["startMin"], message: "Requiere hora de inicio" });
    }
    if (v.endMin === undefined) {
      ctx.addIssue({ code: "custom", path: ["endMin"], message: "Requiere hora de fin" });
    }
    if (v.startMin !== undefined && v.endMin !== undefined && v.endMin <= v.startMin) {
      ctx.addIssue({ code: "custom", path: ["endMin"], message: "Fin debe ser mayor a inicio" });
    }
  }
  if (v.recurrenceType === "WEEKLY" && v.recurrenceDaysOfWeek.length === 0) {
    ctx.addIssue({ code: "custom", path: ["recurrenceDaysOfWeek"], message: "Elige al menos un día para recurrencia semanal" });
  }
  if (v.recurrenceType === "MONTHLY" && v.recurrenceDayOfMonth === null) {
    ctx.addIssue({ code: "custom", path: ["recurrenceDayOfMonth"], message: "Requiere día del mes para recurrencia mensual" });
  }
  if (v.recurrenceType === "YEARLY" && v.recurrenceDayOfMonth !== null && v.recurrenceDayOfMonth !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["recurrenceDayOfMonth"],
      message: "Para recurrencia anual se usa el día y mes de la fecha del evento",
    });
  }
});

export const updateEventSchema = z
  .object({
    title: eventBaseFields.title.optional(),
    date: eventBaseFields.date.optional(),
    allDay: allDayValue.optional(),
    startMin: eventBaseFields.startMin.optional(),
    endMin: eventBaseFields.endMin.optional(),
    location: eventBaseFields.location.optional(),
    color: eventBaseFields.color.optional(),
    recurrenceType: eventBaseFields.recurrenceType.optional(),
    recurrenceInterval: recurrenceIntervalValue.optional(),
    recurrenceDaysOfWeek: recurrenceDaysOfWeekValue.optional(),
    recurrenceDayOfMonth: eventBaseFields.recurrenceDayOfMonth.optional(),
    recurrenceEndsAt: eventBaseFields.recurrenceEndsAt.optional(),
    remindBeforeMin: remindBeforeMinValue.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.allDay === false) {
      if (v.startMin !== undefined && v.endMin !== undefined && v.endMin <= v.startMin) {
        ctx.addIssue({ code: "custom", path: ["endMin"], message: "Fin debe ser mayor a inicio" });
      }
    }
    if (v.recurrenceType === "WEEKLY" && v.recurrenceDaysOfWeek !== undefined && v.recurrenceDaysOfWeek.length === 0) {
      ctx.addIssue({ code: "custom", path: ["recurrenceDaysOfWeek"], message: "Elige al menos un día para recurrencia semanal" });
    }
    if (v.recurrenceType === "MONTHLY" && v.recurrenceDayOfMonth !== undefined && v.recurrenceDayOfMonth !== null && (v.recurrenceDayOfMonth < 1 || v.recurrenceDayOfMonth > 31)) {
      ctx.addIssue({ code: "custom", path: ["recurrenceDayOfMonth"], message: "Día del mes inválido (1-31)" });
    }
  });

export const queryRangeSchema = z
  .object({
    from: dateValue,
    to: dateValue,
  })
  .refine((data) => Date.parse(data.from) <= Date.parse(data.to), {
    message: "La fecha inicial debe ser menor o igual a la final",
    path: ["to"],
  });

export const createEventExceptionSchema = z
  .object({
    date: dateValue,
    targetDate: dateValue.nullable().optional(),
    action: z.enum(["skip", "move"]),
    startMin: z.number().int().min(0).max(1439).optional(),
    endMin: z.number().int().min(1).max(1440).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "skip" && data.targetDate !== undefined && data.targetDate !== null) {
      ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Saltar no admite una fecha destino" });
    }
    if (data.action === "move" && data.targetDate === undefined && (data.startMin === undefined || data.endMin === undefined || data.endMin - data.startMin < 5)) {
      ctx.addIssue({ code: "custom", path: ["endMin"], message: "Al mover, debes especificar startMin y endMin (duración >= 5)" });
    }
    if (data.action === "move" && ((data.startMin === undefined) !== (data.endMin === undefined))) {
      ctx.addIssue({ code: "custom", path: ["endMin"], message: "startMin y endMin deben enviarse juntos" });
    }
  });

export const exceptionIdParamSchema = z.object({
  id: z.string().uuid("El identificador no es válido"),
  exceptionId: z.string().uuid("La excepción no es válida"),
});

export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
export type QueryRangeDto = z.infer<typeof queryRangeSchema>;
export type CreateEventExceptionDto = z.infer<typeof createEventExceptionSchema>;
