"use client";

import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthProvider";

type Consent = {
  client: { name: string; redirect_uri: string };
  user: { email: string };
  request: {
    client_id: string;
    response_type: "code";
    redirect_uri: string;
    scope: string;
    scopes: string[];
    state: string | null;
    code_challenge: string;
    code_challenge_method: "S256";
    resource: string;
  };
};

type Decision = { redirect_uri: string; code?: string; state: string | null; iss?: string; error?: string; error_description?: string };

const scopeLabels: Record<string, string> = {
  profile: "Tu perfil básico",
  email: "Tu correo electrónico",
  "tasks:read": "Consultar tus tareas y agenda",
  "tasks:write": "Crear y actualizar tus tareas",
  "events:read": "Consultar tus eventos",
  "events:write": "Crear y actualizar tus eventos",
  "projects:read": "Consultar tus proyectos",
  "projects:write": "Crear y actualizar tus proyectos",
  "notes:read": "Consultar tus notas",
  "notes:write": "Crear y actualizar tus notas",
  "timeblocks:read": "Consultar tus bloques de tiempo",
  "timeblocks:write": "Crear y actualizar tus bloques de tiempo",
};

export default function OAuthAuthorizePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const query = new URLSearchParams(window.location.search);
    const returnTo = `/oauth/authorize${window.location.search}`;
    if (!isAuthenticated) {
      window.location.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    void api
      .get<Consent>("/oauth/authorize", { params: Object.fromEntries(query.entries()) })
      .then((response) => setConsent(response.data))
      .catch((reason: { message?: string }) => setError(reason.message ?? "La solicitud OAuth no es válida."));
  }, [isAuthenticated, isLoading]);

  async function decide(decision: "approve" | "deny") {
    if (!consent) return;
    setPending(true);
    try {
      const response = await api.post<Decision>("/oauth/authorize", { ...consent.request, decision });
      const result = response.data;
      const callback = new URL(result.redirect_uri ?? consent.request.redirect_uri);
      if (result.code) callback.searchParams.set("code", result.code);
      if (result.error) {
        callback.searchParams.set("error", result.error);
        if (result.error_description) callback.searchParams.set("error_description", result.error_description);
      }
      if (result.state) callback.searchParams.set("state", result.state);
      if (result.iss) callback.searchParams.set("iss", result.iss);
      window.location.assign(callback.toString());
    } catch (reason) {
      setPending(false);
      setError((reason as { message?: string }).message ?? "No se pudo completar la autorización.");
    }
  }

  if (isLoading || (!consent && !error)) return <OAuthShell><p className="font-body-md text-body-md text-on-surface-variant">Verificando tu sesión...</p></OAuthShell>;
  if (error) return <OAuthShell><ErrorState message={error} /></OAuthShell>;
  if (!consent) return null;

  return (
    <OAuthShell>
      <div className="rounded-lg border border-outline-variant bg-surface p-6 shadow-cadence-2 sm:p-8">
        <div className="mb-7 flex size-12 items-center justify-center rounded-lg bg-primary text-on-primary">
          <ShieldCheck aria-hidden="true" size={25} />
        </div>
        <p className="font-label-caps text-label-caps text-secondary">AUTORIZACIÓN NISKY</p>
        <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">Conectar {consent.client.name}</h1>
        <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
          Esta aplicación quiere acceder a Nisky en nombre de <strong className="text-on-surface">{consent.user.email}</strong>.
        </p>

        <div className="mt-6 rounded-md border border-outline-variant bg-surface-container-low p-4">
          <p className="font-label-md text-label-md font-medium text-on-surface">Permisos solicitados</p>
          <ul className="mt-3 grid gap-3">
            {consent.request.scopes.map((scope) => (
              <li className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant" key={scope}>
                <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-secondary" size={16} />
                <span>{scopeLabels[scope] ?? scope}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 font-body-sm text-body-sm text-on-surface-variant">Esta conexión usa tokens con expiración y puede revocarse desde el cliente OAuth.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button disabled={pending} onClick={() => void decide("deny")} variant="outline">Rechazar</Button>
          <Button disabled={pending} onClick={() => void decide("approve")}>{pending ? "Conectando..." : "Autorizar"}</Button>
        </div>
      </div>
    </OAuthShell>
  );
}

function OAuthShell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-8"><div className="w-full max-w-md">{children}</div></main>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-error/30 bg-error-container p-6 text-on-error-container"><AlertCircle aria-hidden="true" className="mb-3" size={22} /><p className="font-body-md text-body-md">{message}</p></div>;
}
