import { z } from "zod";
import { isCalendarDate } from "../../utils/calendar-date";

export const idParamSchema = z.object({ id: z.uuid("El identificador no es válido") });

const dateValue = z.string().refine(isCalendarDate, "La fecha no es válida");

const timeBlockFields = {
  projectId: z.uuid("El proyecto no es válido").nullable().optional(),
  date: dateValue.nullable().optional(),
  name: z.string().trim().max(100).nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, "Elige al menos un día"),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  repeatEveryWeeks: z.number().int().min(1).max(52).optional(),
  repeatEndsAt: dateValue.nullable().optional(),
  remindBeforeMin: z.number().int().min(0).max(1440).optional(),
};

export const createTimeBlockSchema = z
  .object(timeBlockFields)
  .refine((value) => value.endMin - value.startMin >= 5, {
    message: "El bloque debe durar al menos 5 minutos",
    path: ["endMin"],
  });

export const updateTimeBlockSchema = z
  .object({
    ...timeBlockFields,
    projectId: timeBlockFields.projectId,
    name: timeBlockFields.name,
    effectiveFrom: dateValue.optional(),
    daysOfWeek: timeBlockFields.daysOfWeek.optional(),
    startMin: timeBlockFields.startMin.optional(),
    endMin: timeBlockFields.endMin.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) => value.startMin === undefined || value.endMin === undefined || value.endMin - value.startMin >= 5,
    {
      message: "El bloque debe durar al menos 5 minutos",
      path: ["endMin"],
    },
  );

export const updateTimeBlockSettingsSchema = z
  .object({
    dayStartMin: z.number().int().min(0).max(1439),
    dayEndMin: z.number().int().min(1).max(1440),
  })
  .refine((value) => value.dayEndMin > value.dayStartMin, {
    message: "El fin del día debe ser mayor al inicio",
    path: ["dayEndMin"],
  });

export type CreateTimeBlockDto = z.infer<typeof createTimeBlockSchema>;
export type UpdateTimeBlockDto = z.infer<typeof updateTimeBlockSchema>;
export type UpdateTimeBlockSettingsDto = z.infer<typeof updateTimeBlockSettingsSchema>;

export const createTimeBlockExceptionSchema = z.object({
  date: dateValue,
  targetDate: dateValue.nullable().optional(),
  action: z.enum(["skip", "move"]),
  startMin: z.number().int().min(0).max(1439).optional(),
  endMin: z.number().int().min(1).max(1440).optional(),
}).superRefine((data, ctx) => {
  if (data.action === "skip" && data.targetDate !== undefined && data.targetDate !== null) {
    ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Saltar no admite una fecha destino" });
  }
  if (data.action === "move" && (data.startMin === undefined || data.endMin === undefined || data.endMin - data.startMin < 5)) {
    ctx.addIssue({ code: "custom", path: ["endMin"], message: "Al mover, debes especificar startMin y endMin (duración >= 5)" });
  }
  if (data.action === "move" && ((data.startMin === undefined) !== (data.endMin === undefined))) {
    ctx.addIssue({ code: "custom", path: ["endMin"], message: "startMin y endMin deben enviarse juntos" });
  }
});
export type CreateTimeBlockExceptionDto = z.infer<typeof createTimeBlockExceptionSchema>;

export const exceptionIdParamSchema = z.object({
  id: z.uuid("El identificador no es válido"),
  exceptionId: z.uuid("La excepción no es válida"),
});

export const timeBlockExceptionRangeSchema = z
  .object({
    from: dateValue.optional(),
    to: dateValue.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "La fecha inicial debe ser menor o igual a la final",
    path: ["to"],
  });
