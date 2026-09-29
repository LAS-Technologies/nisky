"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";

export function JournalLocked() {
  const { logout } = useAuth();

  return (
    <OfficialPage><OfficialHeader eyebrow="DIARIO" title="Tu espacio personal" description="Una pausa para pensar, solo para ti."/>
      <div className="official-panel official-empty">
        <Lock className="mx-auto text-primary" size={28} />
        <h2 className="mt-3 font-headline-xs text-headline-xs font-bold text-primary">Tu diario está protegido</h2>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          Tu diario se guarda con un candado que solo se abre mientras estás aquí. Entra de nuevo y podrás seguir escribiendo.
        </p>
        <button className="mt-4 min-h-11 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary shadow-cadence-1 transition-colors hover:bg-primary/90" onClick={() => void logout()} type="button">
          Iniciar sesión de nuevo
        </button>
      </div>
    </OfficialPage>
  );
}
