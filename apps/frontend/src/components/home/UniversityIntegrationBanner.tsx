"use client";

import { GraduationCap, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getIntegrations } from "@/features/integrations/api/integrations";

export function UniversityIntegrationBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const integrationsQuery = useQuery({ queryKey: ["integrations"], queryFn: getIntegrations });
  const storageKey = user?.id ? `nisky:university-integration-banner:${user.id}` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    // Keep the dismissal scoped to the authenticated user on this browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(window.localStorage.getItem(storageKey) === "true");
  }, [storageKey]);

  if (
    !user
    || integrationsQuery.isLoading
    || integrationsQuery.isError
    || (integrationsQuery.data?.length ?? 0) > 0
    || dismissed
    || !storageKey
  ) {
    return null;
  }

  const dismiss = () => {
    window.localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  return (
    <aside className="flex items-start gap-3 rounded-lg border border-secondary/30 bg-secondary-container/35 p-4" role="region" aria-label="Integración universitaria">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-container text-secondary">
        <GraduationCap aria-hidden="true" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body-md text-body-md font-semibold text-on-surface">Integra tu universidad</p>
        <p className="mt-1 max-w-2xl font-body-sm text-body-sm text-on-surface-variant">
          Conecta tu plataforma educativa para tener tus tareas y fechas importantes en un solo lugar.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="min-h-10 rounded-md bg-secondary px-3 py-2 font-body-sm text-body-sm font-semibold text-on-secondary hover:bg-primary"
            onClick={() => router.push("/settings?tab=integrations")}
            type="button"
          >
            Ver integraciones
          </button>
          <button
            aria-label="Cerrar aviso de integración universitaria"
            className="min-h-10 rounded-md border border-secondary/30 px-3 py-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low"
            onClick={dismiss}
            type="button"
          >
            Ahora no
            <X aria-hidden="true" className="ml-1 inline" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
