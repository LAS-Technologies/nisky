"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { CaptureProvider, useCapture } from "@/context/CaptureContext";
import { PendingRemindersGate } from "@/features/reminders/components/PendingRemindersGate";
import { QuickCaptureModal } from "@/features/quicknotes/components/QuickCaptureModal";
import { Sidebar } from "@/components/ui/Sidebar";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";
import { TasksSidebarProvider } from "@/context/TasksSidebarContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CaptureProvider>
      <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>
    </CaptureProvider>
  );
}

function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const capture = useCapture();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const stored = localStorage.getItem("app:sidebarCollapsed");
    if (stored !== null) {
      // Hydrate the client preference after SSR without changing the server markup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarCollapsed(stored === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem("app:sidebarCollapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        capture.open("QUICK_NOTE");
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarCollapsed((collapsed) => {
          const next = !collapsed;
          localStorage.setItem("app:sidebarCollapsed", String(next));
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capture]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center font-body-sm text-body-sm text-on-surface-variant">Cargando sesión...</div>;
  }

  if (pathname === "/focus") {
    return (
      <>
        {children}
        <QuickCaptureModal initialMode={capture.mode} onClose={capture.close} open={capture.isOpen} />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <TasksSidebarProvider>
        <Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden pb-16 sm:pb-0">
          <TopAppBar onMenu={() => setMenuOpen(true)} onOpenCapture={() => capture.open("QUICK_NOTE")} />
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </TasksSidebarProvider>
      <PendingRemindersGate />
      <QuickCaptureModal initialMode={capture.mode} onClose={capture.close} open={capture.isOpen} />
      <MobileBottomNav />
    </div>
  );
}
