import type { ReactNode } from "react";
import "./official.css";

export function OfficialHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="official-header"><div><p className="official-eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="official-description">{description}</p>}</div>{actions && <div className="official-actions">{actions}</div>}</header>;
}

export function OfficialPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`official-page ${className}`}>{children}</section>;
}
