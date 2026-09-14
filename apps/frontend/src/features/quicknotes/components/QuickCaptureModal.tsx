"use client";

import { AlarmClock, FileText, StickyNote, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CaptureComposer, type CaptureMode } from "./CaptureComposer";

const modeLabels: Record<CaptureMode, string> = {
  TASK: "Nueva tarea",
  QUICK_NOTE: "Nueva nota rápida",
  REMINDER: "Nuevo recordatorio",
};

function ModeIcon({ mode }: { mode: CaptureMode }) {
  if (mode === "QUICK_NOTE") return <StickyNote aria-hidden="true" size={18} />;
  if (mode === "REMINDER") return <AlarmClock aria-hidden="true" size={18} />;
  return <FileText aria-hidden="true" size={18} />;
}

function CaptureHeading({ mode }: { mode: CaptureMode }) {
  const title = modeLabels[mode];
  const description = mode === "QUICK_NOTE"
    ? "Guárdala en Capturas rápidas para procesarla después."
    : "Captura una idea, tarea o recordatorio sin perder el contexto.";
  return (
    <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant bg-surface-bright px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] text-left">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary-container text-secondary"><ModeIcon mode={mode} /></span>
        <div className="min-w-0">
          <DialogTitle className="font-headline-sm text-headline-sm font-semibold text-on-surface">{title}</DialogTitle>
          <DialogDescription className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{description}</DialogDescription>
        </div>
      </div>
      <DialogClose asChild>
        <button aria-label="Cerrar captura" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button"><X size={19} /></button>
      </DialogClose>
    </DialogHeader>
  );
}

export function QuickCaptureModal({ open, onClose, initialMode = "TASK" }: { open: boolean; onClose: () => void; initialMode?: CaptureMode }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="fixed bottom-auto left-1/2 right-auto top-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none -translate-x-1/2 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-surface-bright p-0 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[88dvh] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:-translate-y-1/2 sm:rounded-lg sm:border sm:border-outline-variant" keyboardAware showCloseButton={false}>
        <CaptureHeading mode={initialMode} />
        <CaptureComposer initialMode={initialMode} key={`${open ? "open" : "closed"}-${initialMode}`} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
