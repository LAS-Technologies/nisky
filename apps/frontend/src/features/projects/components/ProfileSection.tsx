"use client";

import { AtSign, Camera, Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import type { User } from "@/types/entities";
import { useProfileMutations } from "../hooks/useProjects";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "support",
  "me",
  "root",
  "system",
  "nisky",
  "help",
  "settings",
  "profile",
  "login",
  "register",
  "auth",
  "dashboard",
  "projects",
  "tasks",
  "habits",
  "timeblocks",
  "events",
  "integrations",
  "notifications",
  "feedback",
  "journal",
  "notes",
  "focus",
]);

function usernameHint(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  if (trimmed === "") return null;
  if (!USERNAME_REGEX.test(trimmed)) return "Solo letras, números y _ (3-30 caracteres).";
  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) return "Ese nombre no está disponible.";
  return null;
}

export function ProfileSection() {
  const { user, accessToken, setAuth } = useAuth();
  const mutations = useProfileMutations();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [editing, setEditing] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyUser = (updated: Partial<User>) => {
    if (user && accessToken) setAuth({ accessToken, user: { ...user, ...updated } });
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      applyUser(await mutations.update.mutateAsync({ name: trimmed }));
      setEditing(false);
      toast.success("¡Perfil actualizado!");
    } catch {
      toast.error("Ups, no pudimos guardar tu perfil. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const saveUsername = async () => {
    const trimmed = username.trim().replace(/^@/, "");
    if (usernameHint(trimmed) || (!trimmed && user?.username === null && username === "")) return;
    setSaving(true);
    try {
      applyUser(await mutations.update.mutateAsync({ username: trimmed === "" ? null : trimmed.toLowerCase() }));
      setUsername(trimmed === "" ? "" : trimmed.toLowerCase());
      setEditingUsername(false);
      toast.success("¡Nombre de usuario guardado!");
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos guardar el nombre de usuario.");
    } finally {
      setSaving(false);
    }
  };

  const removeUsername = async () => {
    setSaving(true);
    try {
      applyUser(await mutations.update.mutateAsync({ username: null }));
      setUsername("");
      setEditingUsername(false);
      toast.success("Nombre de usuario eliminado");
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? "Ups, no pudimos eliminar el nombre de usuario.");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setSaving(true);
    try {
      applyUser(await mutations.avatar.mutateAsync(file));
      toast.success("¡Foto actualizada!");
    } catch {
      toast.error("Ups, no pudimos subir tu foto. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    setSaving(true);
    try {
      applyUser(await mutations.removeAvatar.mutateAsync());
      toast.success("Foto eliminada");
    } catch {
      toast.error("Ups, no pudimos quitar tu foto. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Tu foto de perfil" className="h-20 w-20 rounded-full border border-outline-variant object-cover" src={user.avatarUrl} />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high font-headline-sm text-headline-sm text-primary">
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="space-y-2">
          <input
            accept="image/*"
            className="hidden"
            onChange={(event) => void upload(event.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="flex items-center gap-1.5 rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm text-primary hover:bg-surface-container-high"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Camera size={14} /> {user?.avatarUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {user?.avatarUrl && (
            <button
              className="flex items-center gap-1.5 rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              disabled={saving}
              onClick={() => void removePhoto()}
              type="button"
            >
              <X size={14} /> Quitar foto
            </button>
          )}
        </div>
      </div>

      <div>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">NOMBRE</span>
        {editing ? (
          <div className="mt-1 flex gap-2">
            <input
              autoFocus
              className="field max-w-xs"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveName();
              }}
              value={name}
            />
            <button aria-label="Guardar nombre" className="flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1.5 font-body-sm text-body-sm text-primary hover:bg-surface-container-high disabled:opacity-50" disabled={saving || !name.trim()} onClick={() => void saveName()} type="button">
              <Check size={14} /> Guardar
            </button>
            <button className="rounded-md border border-outline-variant px-2 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high" onClick={() => { setEditing(false); setName(user?.name ?? ""); }} type="button">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <p className="font-body-md text-body-md">{user?.name ?? "-"}</p>
            <button className="rounded-md border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-primary hover:bg-surface-container-high" onClick={() => setEditing(true)} type="button">
              Editar
            </button>
          </div>
        )}
      </div>

      <div>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">EMAIL</span>
        <p className="mt-1 font-body-md text-body-md">{user?.email ?? "-"}</p>
      </div>

      <div>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">ROL</span>
        <p className="mt-1 font-body-md text-body-md">{user?.role === "ADMIN" ? "Administrador" : "Miembro"}</p>
      </div>

      <div>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">NOMBRE DE USUARIO</span>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
          Úsalo para que te inviten a proyectos con @tu_usuario en lugar del email. Opcional.
        </p>
        {editingUsername ? (
          <div className="mt-2">
            <div className="flex gap-2">
              <div className="relative max-w-xs flex-1">
                <AtSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  aria-label="Nombre de usuario"
                  autoFocus
                  className="field h-9 w-full pl-8"
                  maxLength={30}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveUsername();
                  }}
                  placeholder="tu_usuario"
                  value={username}
                />
              </div>
              <button
                aria-label="Guardar nombre de usuario"
                className="flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1.5 font-body-sm text-body-sm text-primary hover:bg-surface-container-high disabled:opacity-50"
                disabled={saving || Boolean(usernameHint(username.trim().replace(/^@/, "")))}
                onClick={() => void saveUsername()}
                type="button"
              >
                <Check size={14} /> Guardar
              </button>
              <button
                className="rounded-md border border-outline-variant px-2 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high"
                onClick={() => {
                  setEditingUsername(false);
                  setUsername(user?.username ?? "");
                }}
                type="button"
              >
                Cancelar
              </button>
            </div>
            {usernameHint(username.trim().replace(/^@/, "")) ? (
              <p className="mt-1 font-body-sm text-body-sm text-error">{usernameHint(username.trim().replace(/^@/, ""))}</p>
            ) : username.trim() ? (
              <p className="mt-1 font-data-mono text-data-mono text-xs text-on-surface-variant">Tu invitación será: @{username.trim().replace(/^@/, "").toLowerCase()}</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <p className="font-data-mono text-data-mono">{user?.username ? `@${user.username}` : "-"}</p>
            <button className="rounded-md border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-primary hover:bg-surface-container-high" onClick={() => { setEditingUsername(true); setUsername(user?.username ?? ""); }} type="button">
              {user?.username ? "Editar" : "Crear"}
            </button>
            {user?.username && (
              <button
                className="rounded-md border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                disabled={saving}
                onClick={() => void removeUsername()}
                type="button"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
