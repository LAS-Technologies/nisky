"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { useAuth } from "@/context/AuthProvider";

export function JournalLocked() {
  const { logout } = useAuth();

  return (
    <OfficialPage><OfficialHeader eyebrow="DIARIO" title="Tu espacio personal" description="Una pausa para pensar, solo para ti."/>
      <div className="official-panel official-empty">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" height={230} src="/design-official/otter-at-desk.png" width={500} />
        <h2 className="mt-3 font-headline-xs text-headline-xs font-bold text-primary">Tu diario está protegido</h2>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          Vuelve a iniciar sesión para abrir tus entradas y continuar escribiendo en tu espacio privado.
        </p>
        <button className="mt-4 min-h-11 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm text-on-primary shadow-cadence-1 transition-colors hover:bg-primary/90" onClick={() => void logout()} type="button">
          Volver a iniciar sesión
        </button>
      </div>
    </OfficialPage>
  );
}
