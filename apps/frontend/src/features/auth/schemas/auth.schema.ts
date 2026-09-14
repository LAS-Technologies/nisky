import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa tu correo o nombre de usuario").max(120, "Máximo 120 caracteres"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Cuéntanos tu nombre").max(80, "Máximo 80 caracteres"),
  username: z
    .string()
    .trim()
    .max(30, "Máximo 30 caracteres")
    .refine((value) => value === "" || /^[a-zA-Z0-9_]{3,30}$/.test(value), "Usa solo letras, números y _ (3-30 caracteres)")
    .optional(),
  email: z.email("Ese correo no parece válido"),
  password: z.string().min(8, "Mínimo 8 caracteres").regex(/[A-Z]/, "Incluye una mayúscula").regex(/[0-9]/, "Incluye un número"),
  confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
