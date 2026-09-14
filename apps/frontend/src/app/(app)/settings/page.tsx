"use client";

import { useEffect, useState } from "react";
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
    if (!requested || !tabs.some((tab) => tab.id === requested && (!tab.adminOnly || isAdmin))) return;
    // Allow the home integration banner to open the correct settings section.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(requested as Tab);
  }, [isAdmin]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background p-container-padding sm:p-section-gap">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-cadence-1">
        <div className="shrink-0 border-b border-outline-variant bg-surface-container-low px-4 pt-4 sm:px-6 sm:pt-5">
          <h2 className="px-0 pb-2 font-headline-md text-headline-md text-on-surface">Ajustes</h2>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                className={`min-h-11 rounded-t-md border-b-2 px-3 py-2 font-label-md text-label-md transition-colors ${active === tab.id ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface hover:text-on-surface"}`}
                key={tab.id}
                onClick={() => setActive(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-container-padding sm:p-section-gap">
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
    </section>
  );
}
