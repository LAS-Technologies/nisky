"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { PasswordInput } from "@/components/ui/PasswordInput";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminUserMutations } from "@/features/admin/hooks/useAdmin";
import { adminUserFormSchema, type AdminUserFormData } from "@/features/admin/schemas/admin.schema";
import type { UserAdmin } from "@/types/admin";
import type { ApiError } from "@/types/api.types";

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) return String((error as ApiError).message);
  return fallback;
}

type Props = {
  user: UserAdmin | null;
  onClose: () => void;
};

export function UserFormModal({ user, onClose }: Props) {
  const { user: me } = useAuth();
  const mutations = useAdminUserMutations();
  const isSelf = user?.id === me?.id;
  const [form, setForm] = useState<AdminUserFormData>(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "USER",
    isActive: user?.isActive ?? true,
    password: "",
    confirmPassword: "",
  }));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof AdminUserFormData>(key: K, value: AdminUserFormData[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const result = adminUserFormSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    setError("");
    const { name, email, role, isActive, password } = result.data;
    const payload = { name, role, isActive, ...(password ? { password } : {}) };
    try {
      if (user) {
        await mutations.update.mutateAsync({ id: user.id, payload });
        toast.success("¡Usuario actualizado!");
      } else {
        await mutations.create.mutateAsync({ name, email, role, password });
        toast.success("¡Usuario creado!");
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Ups, no pudimos guardar el usuario. Inténtalo de nuevo."));
    }
  };

  const remove = async () => {
    if (!user) return;
    try {
      await mutations.remove.mutateAsync(user.id);
      toast.success("¡Usuario eliminado!");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Ups, no pudimos eliminar el usuario. Inténtalo de nuevo."));
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden rounded-lg border-outline-variant bg-surface p-0" keyboardAware showCloseButton={false}>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant bg-surface-bright px-5 py-4 text-left">
          <div>
            <DialogTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">{user ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription className="sr-only">Administra los datos y permisos del usuario.</DialogDescription>
          </div>
          <DialogClose asChild>
            <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button"><X size={19} /></button>
          </DialogClose>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" data-modal-scroll>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">NOMBRE</span>
            <input autoFocus className="field mt-1" onChange={(event) => set("name", event.target.value)} value={form.name} />
          </label>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">EMAIL</span>
            <input autoComplete="off" className="field mt-1" disabled={Boolean(user)} onChange={(event) => set("email", event.target.value)} type="email" value={form.email} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">ROL</span>
              <select className="field mt-1" disabled={isSelf} onChange={(event) => set("role", event.target.value as "ADMIN" | "USER")} value={form.role}>
                <option value="USER">Usuario</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <label className="block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">ESTADO</span>
              <select className="field mt-1" disabled={isSelf} onChange={(event) => set("isActive", event.target.value === "true")} value={String(form.isActive)}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">{user ? "NUEVA CONTRASEÑA (OPCIONAL)" : "CONTRASEÑA"}</span>
              <PasswordInput autoComplete="new-password" onChange={(event) => set("password", event.target.value)} value={form.password} />
            </label>
            <label className="block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">CONFIRMAR CONTRASEÑA</span>
              <PasswordInput autoComplete="new-password" onChange={(event) => set("confirmPassword", event.target.value)} value={form.confirmPassword} />
            </label>
          </div>
          {error && <p className="rounded-md border border-error bg-error-container p-2 font-body-sm text-body-sm text-on-error-container">{error}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-outline-variant bg-surface-container-low px-5 py-4 sm:gap-3">
          {user && !isSelf ? (
            <button
              className={`${confirmDelete ? "rounded-md bg-error px-3 py-2 font-body-sm text-body-sm text-error-foreground" : "rounded-md px-2 py-2 font-body-sm text-body-sm text-error hover:bg-error-container/30"} whitespace-nowrap`}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                void remove();
              }}
              type="button"
            >
              {confirmDelete ? "¿Eliminar usuario?" : "Eliminar"}
            </button>
          ) : <span />}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button className="min-h-11 whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2 font-body-sm text-body-sm hover:bg-surface-container-high" onClick={onClose} type="button">Cancelar</button>
            <button className="min-h-11 whitespace-nowrap rounded-md bg-primary-container px-4 py-2 font-body-sm text-body-sm text-on-primary hover:bg-primary" onClick={() => void save()} type="button">
              {mutations.create.isPending || mutations.update.isPending ? "Guardando..." : user ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
