import { z } from "zod";
import { isValidUsername } from "../../utils/validation/username";

const passwordSchema = z
  .string("La contraseña es requerida")
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
  .regex(/[0-9]/, "La contraseña debe tener al menos un número");

export const loginSchema = z.object({
  identifier: z
    .string("El correo o nombre de usuario es requerido")
    .trim()
    .min(1, "El correo o nombre de usuario es requerido")
    .max(120, "El identificador es demasiado largo"),
  password: z.string("La contraseña es requerida").min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const registerSchema = z.object({
  name: z.string("El nombre es requerido").trim().min(1, "El nombre es requerido").max(80),
  username: z
    .string()
    .trim()
    .max(30, "El nombre de usuario debe tener máximo 30 caracteres")
    .refine((value) => value === "" || isValidUsername(value), {
      message: "Solo letras, números y _ (3-30 caracteres), y no puede estar reservado",
    })
    .transform((value) => (value === "" ? null : value.toLowerCase()))
    .optional(),
  email: z.email("El formato del correo electrónico es inválido").transform((value) => value.toLowerCase()),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string("La contraseña actual es requerida").min(1, "La contraseña actual es requerida"),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    name: z.string("El nombre es requerido").trim().min(1, "El nombre es requerido").max(80).optional(),
    username: z
      .string()
      .trim()
      .max(30, "El nombre de usuario debe tener máximo 30 caracteres")
      .transform((value) => (value.startsWith("@") ? value.slice(1) : value))
      .refine((value) => value === "" || isValidUsername(value), {
        message: "Solo letras, números y _ (3-30 caracteres), y no puede estar reservado",
      })
      .transform((value) => (value === "" ? null : value.toLowerCase()))
      .nullable()
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.username !== undefined, {
    message: "No hay nada que actualizar",
  });

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
