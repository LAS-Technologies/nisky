"use client";
import "@/components/ui/official.css";

import { ExternalLink, Pause, Play, Square, Timer, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { PomodoroSession } from "@/types/entities";
import { formatPomodoroTime } from "../lib/time";

export function PomodoroPictureInPicture({
  session,
  remainingSec,
  onCancel,
  onClose,
  onOpenFocus,
  onPauseResume,
}: {
  session: PomodoroSession | null;
  remainingSec: number | null;
  onCancel: () => Promise<void>;
  onClose: () => void;
  onOpenFocus: (taskId: string | null) => void;
  onPauseResume: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const run = async (action: () => Promise<void>, errorMessage: string) => {
    if (pending) return;
    setPending(true);
    try {
      await action();
    } catch {
      toast.error(errorMessage);
    } finally {
      setPending(false);
    }
  };

  if (!session || remainingSec === null) {
    return (
      <main className="box-border flex min-h-screen min-w-0 w-full flex-col items-center justify-center gap-[clamp(0.5rem,2vw,0.75rem)] overflow-hidden bg-surface p-[clamp(0.75rem,3vw,1rem)] text-center text-on-surface">
        <Timer className="text-primary" size={22} />
        <p className="font-body-sm text-body-sm font-semibold">No hay un Pomodoro activo</p>
        <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low" onClick={onClose} type="button">
          <X aria-hidden="true" size={14} /> Cerrar
        </button>
      </main>
    );
  }

  const paused = session.status === "PAUSED";
  const taskLabel = session.task?.title ?? (session.phase === "WORK" ? "Sesión de enfoque" : "Descanso");

  return (
    <main className="official-pip">
      <header className="flex min-w-0 items-center justify-between gap-2"><h1 className="text-primary font-semibold">Nisky · Enfoque</h1>
        <div className="flex min-w-0 items-center gap-2">
          <Timer aria-hidden="true" className="shrink-0 text-primary" size={16} />
          <div className="min-w-0">
            <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{paused ? "Pausado" : session.phase === "WORK" ? "Enfoque" : "Descanso"}</p>
            <p className="truncate font-body-sm text-body-sm font-semibold text-on-surface" title={taskLabel}>{taskLabel}</p>
          </div>
        </div>
        <button aria-label="Cerrar ventana Picture-in-Picture" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" onClick={onClose} type="button">
          <X aria-hidden="true" size={15} />
        </button>
      </header>
      <p className="official-pip-session">SESIÓN {session.cycleIndex}</p>
      <button aria-label="Abrir modo enfoque" className="block w-full min-w-0 rounded-lg px-1 py-0.5 text-center font-data-mono text-[clamp(3rem,16vw,4.5rem)] font-semibold tabular-nums tracking-tight text-primary hover:bg-primary-fixed" onClick={() => onOpenFocus(session.taskId)} type="button">
        {formatPomodoroTime(remainingSec)}
      </button>
      <p className="text-center">{taskLabel}</p>
      <div className="flex items-center gap-2">
        <button aria-label={paused ? "Reanudar Pomodoro" : "Pausar Pomodoro"} className="flex min-h-[clamp(2.25rem,10vw,2.75rem)] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant px-[clamp(0.5rem,2vw,0.75rem)] font-label-md text-label-md font-semibold text-on-surface-variant hover:border-primary hover:bg-primary-fixed hover:text-primary disabled:cursor-wait disabled:opacity-60" disabled={pending} onClick={() => void run(onPauseResume, "Ups, no pudimos actualizar el Pomodoro.")} type="button">
          {paused ? <Play aria-hidden="true" size={14} /> : <Pause aria-hidden="true" size={14} />}
          {paused ? "Reanudar" : "Pausar"}
        </button>
        <button aria-label="Cancelar Pomodoro" className="flex h-[clamp(2.25rem,10vw,2.75rem)] w-[clamp(2.25rem,10vw,2.75rem)] shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:border-error hover:bg-error-container hover:text-error disabled:cursor-wait disabled:opacity-60" disabled={pending} onClick={() => void run(onCancel, "Ups, no pudimos cancelar el Pomodoro.")} type="button">
          <Square aria-hidden="true" size={14} />
        </button>
      </div>
      <button className="inline-flex min-h-7 w-full items-center justify-center gap-1 font-label-md text-label-md font-semibold text-primary hover:bg-primary-fixed" onClick={() => onOpenFocus(session.taskId)} type="button">
        <ExternalLink aria-hidden="true" size={13} /> Abrir enfoque
      </button>
    </main>
  );
}
