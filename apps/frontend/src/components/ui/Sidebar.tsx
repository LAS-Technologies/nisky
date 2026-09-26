"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  X,
} from "lucide-react";
import { useState } from "react";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark } from "@/components/ui/BrandMark";
import Image from "next/image";
import type { User } from "@/types/entities";
import { desktopPrimaryItems, desktopSecondaryItems, isNavigationItemActive, type NavigationItem } from "@/components/ui/navigation";

function NavItem({
  href,
  label,
  icon: Icon,
  onNavigate,
  collapsed,
  primary = false,
  }: {
  href: NavigationItem["href"];
  label: NavigationItem["label"];
  icon: NavigationItem["icon"];
  onNavigate?: () => void;
  collapsed?: boolean;
  primary?: boolean;
}) {
  const pathname = usePathname();
  const active = isNavigationItemActive(pathname, href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-element-gap-md rounded-md px-3.5 py-2.5 font-body-md text-body-md transition-colors ${primary ? "min-h-14" : "min-h-11"} ${active ? "bg-primary-fixed font-semibold text-primary" : "font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"} ${collapsed ? "lg:mx-0 lg:w-12 lg:justify-center lg:gap-0 lg:px-0" : ""}`}
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
    >
      <Icon className={active ? "text-secondary" : "text-on-surface-variant/70"} size={20} strokeWidth={active ? 2 : 1.8} />
      <span className={collapsed ? "lg:hidden" : undefined}>{label}</span>
    </Link>
  );
}

export function Sidebar({
  user,
  open,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      {open && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 hidden bg-on-surface/20 sm:block lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-50 hidden w-[294px] shrink-0 flex-col border-r border-outline-variant bg-surface transition-all duration-200 sm:flex lg:relative lg:z-auto lg:translate-x-0 ${collapsed ? "lg:w-16" : "lg:w-[294px]"} ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-[130px] shrink-0 items-center justify-between px-8 py-4 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <Link
            className="flex items-center gap-4 font-display-hero text-display-hero font-bold tracking-tight text-primary"
            href="/"
            aria-label="Nisky, ir a Inicio"
          >
            <BrandMark size={collapsed ? 40 : 76} />
            {collapsed ? (
              <>
                <span className="lg:hidden">Nisky</span>
              </>
            ) : (
              "Nisky"
            )}
          </Link>
          <button
            aria-label="Cerrar menú"
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <div
          className={`mx-[22px] mb-4 flex min-h-[70px] shrink-0 items-center gap-element-gap-md rounded-[12px] border border-info/25 bg-surface p-2.5 ${collapsed ? "lg:mx-2 lg:justify-center lg:border-transparent lg:bg-transparent lg:p-0" : ""}`}
        >
          <Avatar avatarUrl={user?.avatarUrl} className="h-9 w-9" email={user?.email} name={user?.name} size="md" />
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="truncate font-body-md text-body-md font-semibold">
              {user?.name ?? "Usuario"}
            </p>
            <p className="truncate font-data-mono text-data-mono text-on-surface-variant">
              {user?.email}
            </p>
          </div>
        </div>
        <nav className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1 ${collapsed ? "px-2" : "px-[22px]"}`}>
          {desktopPrimaryItems.map((item) => (
            <NavItem {...item} primary collapsed={collapsed} key={item.href} onNavigate={onClose} />
          ))}
        </nav>
        <div className={`shrink-0 border-t border-outline-variant/70 px-4 py-2 ${collapsed ? "lg:px-2" : ""}`}>
          <p className={`mb-2 px-3 font-label-caps text-label-caps text-on-surface-variant ${collapsed ? "lg:hidden" : ""}`}>CUENTA Y AYUDA</p>
          <div className="space-y-1">
            {desktopSecondaryItems.map((item) => (
              <NavItem {...item} collapsed={collapsed} key={item.href} onNavigate={onClose} />
            ))}
            <button
              className={`flex min-h-11 w-full items-center gap-element-gap-md rounded-md px-3.5 py-2.5 text-left font-body-md text-body-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface ${collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}
              onClick={() => {
                onClose();
                setFeedbackOpen(true);
              }}
              title={collapsed ? "Feedback" : undefined}
              type="button"
            >
              <MessageSquarePlus size={20} strokeWidth={1.8} />
              <span className={collapsed ? "lg:hidden" : undefined}>Feedback</span>
            </button>
          </div>
          <div className={`mt-6 flex h-[62px] items-center justify-center border-t border-outline-variant/60 pt-3 ${collapsed ? "lg:hidden" : ""}`}>
            <Image alt="LAS" height={30} src="/las-logo-approved.png" width={96} />
          </div>
        </div>
        <button
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-5 z-50 hidden h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant shadow-sm transition-colors hover:border-primary hover:text-primary lg:flex"
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú (Alt+B)" : "Colapsar menú (Alt+B)"}
          type="button"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
