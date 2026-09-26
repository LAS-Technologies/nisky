import { cn } from "@/lib/utils";
import "./projects.css";

export function ProjectWorkspaceShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("project-workspace projects-official", className)}>
      <div className="projects-content">
        {children}
      </div>
    </section>
  );
}
