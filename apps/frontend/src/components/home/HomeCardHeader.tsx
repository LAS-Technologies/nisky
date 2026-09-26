import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function HomeCardHeader({ icon: Icon, title, subtitle, action, count }: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  count?: ReactNode;
}) {
  return (
    <header className="home-card-header">
      <span className="home-card-icon"><Icon size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <h2>{title}</h2>
          {count && <span className="font-body-sm text-body-sm text-on-surface-variant">{count}</span>}
        </div>
        {subtitle && <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
