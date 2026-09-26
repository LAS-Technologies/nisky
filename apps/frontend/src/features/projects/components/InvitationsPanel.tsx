"use client";

import { UserPlus } from "lucide-react";
import { ProjectInvitationsDialog } from "./ProjectInvitationsDialog";
import { usePendingInvitations } from "../hooks/useProjects";

export function InvitationsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const invitationsQuery = usePendingInvitations();
  const invitations = invitationsQuery.data ?? [];
  const pending = invitations.length;

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label={`Invitaciones a proyectos${pending > 0 ? ` (${pending})` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <UserPlus size={19} />
        {pending > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-data-mono text-[10px] text-on-primary">
            {pending > 9 ? "9+" : pending}
          </span>
        )}
      </button>
      {open && <ProjectInvitationsDialog open onOpenChange={onOpenChange} />}
    </div>
  );
}
