"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { startTransition, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { PasswordSection } from "@/components/admin/PasswordSection";
import { PatSection } from "@/components/admin/PatSection";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { UserManagement } from "@/components/admin/UserManagement";
import { IntegrationManager } from "@/components/integrations/IntegrationManager";
import { IntegrationTasksList } from "@/components/integrations/IntegrationTasksList";
import { NotificationSettingsPanel } from "@/components/pwa/NotificationSettingsPanel";
import { ProfileSection } from "@/features/projects/components/ProfileSection";
import { FeedbackAdminPanel } from "@/components/feedback/FeedbackAdminPanel";

type Tab = "profile" | "security" | "notifications" | "integrations" | "admin";

const tabs: Array<{ id: Tab; label: string; adminOnly?: boolean }> = [
  { id: "profile", label: "Perfil" },
  { id: "security", label: "Seguridad" },
  { id: "notifications", label: "Notificaciones" },
  { id: "integrations", label: "Integraciones" },
  { id: "admin", label: "Administración", adminOnly: true },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);
  const [active, setActive] = useState<Tab>(visibleTabs[0]?.id ?? "profile");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && tabs.some((tab) => tab.id === requested && (!tab.adminOnly || isAdmin))) {
      startTransition(() => setActive(requested as Tab));
    }
  }, [isAdmin]);

  return (
    <OfficialPage>
      <OfficialHeader eyebrow="AJUSTES" title="Ajustes" description={{ profile: "Haz que Nisky se sienta tuyo.", security: "Cuida el acceso a tu espacio.", notifications: "Tú decides cómo recibir tus avisos.", integrations: "Tu universidad, conectada con tu día.", admin: "Gestiona el acceso y escucha a tu comunidad." }[active]}/>
      <div className="official-settings-nav" role="tablist" aria-label="Secciones de ajustes">
        {visibleTabs.map((tab) => (
          <button
            aria-selected={active === tab.id}
            className="official-button"
            key={tab.id}
            onClick={() => setActive(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

        <div className="official-settings-content" role="tabpanel" aria-label={tabs.find(tab => tab.id === active)?.label}>
          {active === "profile" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(240px,.85fr)]">
              <section className="official-panel">
                <h2>Tu perfil</h2>
                <ProfileSection />
              </section>
              <aside className="official-panel">
                <h2>Tu espacio en Nisky</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Un nombre y una imagen ayudan a reconocerte cuando colaboras.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="mx-auto mt-5 h-36 w-full object-contain" height={180} src="/design-official/otter-at-desk.png" width={320} />
              </aside>
            </div>
          )}

          {active === "security" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <PasswordSection />
              <PatSection />
            </div>
          )}

          {active === "notifications" && (
            <div className="max-w-2xl">
              <NotificationSettingsPanel />
            </div>
          )}

          {active === "integrations" && (
            <div className="space-y-8">
              <IntegrationManager />
              <IntegrationTasksList />
            </div>
          )}

          {active === "admin" && isAdmin && (
            <div className="space-y-6">
              <SettingsForm />
              <div className="space-y-2">
                <h3 className="font-headline-xs text-headline-xs">Usuarios</h3>
                <UserManagement />
              </div>
              <div className="space-y-2">
                <h3 className="font-headline-xs text-headline-xs">Feedback</h3>
                <FeedbackAdminPanel />
              </div>
            </div>
          )}
        </div>
    </OfficialPage>
  );
}
