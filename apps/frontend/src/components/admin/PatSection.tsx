"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useCreatePat, usePats, useRevokePat, type PatCreated } from "@/features/auth/hooks/usePersonalAccessTokens";

const schema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre").max(60, "Máximo 60 caracteres"),
  expiresInDays: z
    .union([z.number().int().min(1).max(365), z.literal("")])
    .optional(),
});

type FormData = z.infer<typeof schema>;

const EXPIRY_OPTIONS = [
  { value: "", label: "Sin expiración" },
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function PatSection() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [createdPat, setCreatedPat] = useState<PatCreated | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: pats = [] } = usePats();
  const createMutation = useCreatePat((pat) => {
    toast.success("Token creado");
    setCreatedPat(pat);
    reset();
  });
  const revokeMutation = useRevokePat();

  const copy = async () => {
    if (!createdPat) return;
    try {
      await navigator.clipboard.writeText(createdPat.raw);
      toast.success("Token copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const revoke = () => {
    if (!revokingId) return;
    revokeMutation.mutate(revokingId, {
      onSuccess: () => {
        toast.success("Token revocado");
        setRevokingId(null);
      },
    });
  };

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-container-padding shadow-cadence-1">
      <h3 className="font-headline-xs text-headline-xs text-on-surface">Tokens de acceso</h3>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Usa tokens para conectar herramientas externas (como asistentes de IA) a tu cuenta sin exponer tu contraseña.
      </p>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        ¿Cómo conectar un asistente de IA?{" "}
        <a
          className="text-primary underline"
          href="https://github.com/lorelvis-santos/nisky/blob/main/apps/mcp/GUIA-INTEGRACION.md"
          rel="noopener noreferrer"
          target="_blank"
        >
          Guía de configuración del MCP
        </a>
      </p>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Para conexiones OAuth con ChatGPT o Gemini Spark, usa esta URL de MCP:{" "}
        <code className="font-data-mono text-data-mono text-primary">https://mcp-nisky.las.do/mcp</code>
      </p>

      <form className="mt-4 max-w-sm space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate({
        name: values.name,
        expiresInDays: values.expiresInDays === undefined || values.expiresInDays === "" ? undefined : Number(values.expiresInDays),
      }))}>
        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant">Nombre del token</span>
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md outline-none transition-colors focus:border-secondary"
            placeholder="Ej: MCP local"
            {...register("name")}
          />
          {errors.name && <span className="mt-1 block text-xs text-error">{errors.name.message}</span>}
        </label>
        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant">Expiración</span>
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md outline-none transition-colors focus:border-secondary"
            {...register("expiresInDays")}
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50" disabled={createMutation.isPending} type="submit">
          {createMutation.isPending ? "Creando..." : "Crear token"}
        </button>
        {createMutation.error && <p className="rounded-md border border-error bg-error-container p-2 font-body-sm text-body-sm text-on-error-container">{createMutation.error.message}</p>}
      </form>

      {createdPat && (
        <div className="mt-4 max-w-sm rounded-md border border-secondary bg-secondary-container p-3">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Copia este token ahora. No lo volveremos a mostrar.
          </p>
          <code className="mt-2 block break-all rounded-md border border-outline-variant bg-surface p-2 font-data-mono text-data-mono">
            {createdPat.raw}
          </code>
          <div className="mt-3 flex gap-2">
            <button className="min-h-11 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary transition-colors hover:bg-primary/90" onClick={copy} type="button">
              Copiar token
            </button>
            <button className="min-h-11 rounded-md border border-outline-variant bg-surface px-4 py-2 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-low" onClick={() => setCreatedPat(null)} type="button">
              Ya lo copié
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant">Tokens activos</h4>
        {pats.length === 0 ? (
          <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">No tienes tokens activos.</p>
        ) : (
             <ul className="mt-2 divide-y divide-outline-variant rounded-lg border border-outline-variant">
            {pats.map((pat) => (
              <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:flex-nowrap" key={pat.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-body-md text-body-md">{pat.name}</span>
                    <code className="shrink-0 font-data-mono text-data-mono text-xs text-on-surface-variant">{pat.prefix}…</code>
                  </div>
                  <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                    Último uso: {formatDate(pat.lastUsedAt)} · Expira: {formatDate(pat.expiresAt)}
                  </p>
                </div>
                <button className="min-h-11 rounded-md border border-outline-variant bg-surface px-3 py-1.5 font-body-sm text-body-sm text-error transition-colors hover:bg-error-container/40" onClick={() => setRevokingId(pat.id)} type="button">
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {revokingId && (
        <ConfirmModal
          danger
          title="Revocar token"
          message="¿Seguro que quieres revocar este token? Las herramientas que lo usen dejarán de funcionar de inmediato."
          confirmLabel="Revocar"
          loading={revokeMutation.isPending}
          onClose={() => setRevokingId(null)}
          onConfirm={revoke}
        />
      )}
    </div>
  );
}
