"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { useState } from "react";
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

  return (
    <OfficialPage>
      <OfficialHeader eyebrow="AJUSTES" title="A tu manera" description="Cuida tu cuenta y adapta Nisky a tu ritmo."/>
      <div className="official-settings-grid">
        <div className="official-panel">
          <h2>Tu cuenta</h2>
          <div className="official-settings-nav" role="tablist" aria-label="Secciones de ajustes">
            {visibleTabs.map((tab) => (
              <button
                className="official-button" role="tab" aria-selected={active === tab.id}
                key={tab.id}
                onClick={() => setActive(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="official-panel official-settings-content" role="tabpanel" aria-label={tabs.find(tab => tab.id === active)?.label}>
          {active === "profile" && (
            <div className="space-y-6">
              <ProfileSection />
              <div>
                 <span className="font-label-md text-label-md text-on-surface-variant">Rol</span>
                <p className="mt-1 font-data-mono text-data-mono">{user?.role === "ADMIN" ? "Administrador" : "Miembro"}</p>
              </div>
            </div>
          )}

          {active === "security" && (
            <div className="max-w-2xl space-y-6">
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
      </div>
    </OfficialPage>
  );
}
