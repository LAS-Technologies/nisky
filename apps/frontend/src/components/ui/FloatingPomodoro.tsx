"use client";

import { Pause, PictureInPicture, Play, Square, Timer } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatPomodoroTime, usePomodoro } from "@/context/PomodoroProvider";
import { openPomodoroWindow, supportsDocumentPictureInPicture } from "@/features/pomodoro/lib/window";

export function FloatingPomodoro() {
  const pathname = usePathname();
  const router = useRouter();
  const pomodoro = usePomodoro();
  const session = pomodoro.activeSession;

  if (pathname === "/focus" || !session || pomodoro.remainingSec === null) {
    return null;
  }

  const paused = session.status === "PAUSED";
  const taskLabel = session.task?.title ?? (session.phase === "WORK" ? "Sesión de enfoque" : "Descanso");

  const togglePause = async () => {
    try {
      await pomodoro.pauseResume();
    } catch {
      toast.error("Ups, no pudimos actualizar el Pomodoro.");
    }
  };

  const cancel = async () => {
    try {
      await pomodoro.cancel();
      toast.success("¡Listo, Pomodoro cancelado!");
    } catch {
      toast.error("Ups, no pudimos cancelar el Pomodoro.");
    }
  };

  const openFocus = () => {
    const query = session.taskId ? `?taskId=${encodeURIComponent(session.taskId)}` : "";
    router.push(`/focus${query}`);
  };

  const openWindow = () => {
    if (supportsDocumentPictureInPicture()) {
      void pomodoro.openPictureInPicture().then((opened) => {
        if (!opened) toast.error("No se pudo abrir Picture-in-Picture en este navegador.");
      });
      return;
    }
    if (!openPomodoroWindow()) toast.error("El navegador bloqueó la ventana del Pomodoro.");
  };

  return (
    <aside
      aria-label="Pomodoro en curso"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-3 z-40 hidden w-[min(20rem,calc(100vw-1.5rem))] sm:bottom-5 sm:right-5 sm:block"
      data-preview-floating="true"
    >
      <div className="rounded-2xl border border-primary/25 bg-surface-container-lowest/95 p-3 shadow-cadence-3 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <Timer aria-hidden="true" size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                {paused ? "Pomodoro pausado" : "Pomodoro en curso"}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  aria-label="Abrir Pomodoro en Picture-in-Picture"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant hover:bg-primary-fixed hover:text-primary"
                  onClick={openWindow}
                  title="Abrir en Picture-in-Picture"
                  type="button"
                >
                  <PictureInPicture aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label="Abrir modo enfoque"
                  className="rounded-md px-1.5 py-1 font-data-mono text-data-mono text-lg font-semibold tabular-nums text-primary hover:bg-primary-fixed"
                  onClick={openFocus}
                  type="button"
                >
                  {formatPomodoroTime(pomodoro.remainingSec)}
                </button>
              </div>
            </div>
            <p className="mt-0.5 truncate font-body-sm text-body-sm text-on-surface" title={taskLabel}>
              {taskLabel}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-outline-variant pt-2">
          <button
            aria-label={paused ? "Reanudar Pomodoro" : "Pausar Pomodoro"}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 font-label-md text-label-md font-semibold text-on-surface-variant hover:border-primary hover:bg-primary-fixed hover:text-primary"
            onClick={() => void togglePause()}
            type="button"
          >
            {paused ? <Play aria-hidden="true" size={15} /> : <Pause aria-hidden="true" size={15} />}
            {paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            aria-label="Cancelar Pomodoro"
            className="flex min-h-10 w-10 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:border-error hover:bg-error-container hover:text-error"
            onClick={() => void cancel()}
            type="button"
          >
            <Square aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function PomodoroHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const pomodoro = usePomodoro();
  const session = pomodoro.activeSession;

  if (pathname === "/focus" || !session || pomodoro.remainingSec === null) {
    return null;
  }

  const paused = session.status === "PAUSED";
  const openFocus = () => {
    const query = session.taskId ? `?taskId=${encodeURIComponent(session.taskId)}` : "";
    router.push(`/focus${query}`);
  };

  const togglePause = async () => {
    try {
      await pomodoro.pauseResume();
    } catch {
      toast.error("Ups, no pudimos actualizar el Pomodoro.");
    }
  };

  const cancel = async () => {
    try {
      await pomodoro.cancel();
      toast.success("¡Listo, Pomodoro cancelado!");
    } catch {
      toast.error("Ups, no pudimos cancelar el Pomodoro.");
    }
  };

  return (
    <div
      aria-label="Pomodoro en curso"
      className="flex items-center gap-0.5 rounded-lg border border-primary/25 bg-primary-fixed/60 px-1 py-1"
    >
      <Timer aria-hidden="true" className="mx-1 text-primary" size={15} />
      <button
        aria-label="Abrir modo enfoque"
        className="rounded-md px-1 py-1 font-data-mono text-data-mono text-sm font-semibold tabular-nums text-primary hover:bg-primary-fixed"
        onClick={openFocus}
        type="button"
      >
        {formatPomodoroTime(pomodoro.remainingSec)}
      </button>
      <button
        aria-label={paused ? "Reanudar Pomodoro" : "Pausar Pomodoro"}
        className="flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary-fixed"
        onClick={() => void togglePause()}
        type="button"
      >
        {paused ? <Play aria-hidden="true" size={14} /> : <Pause aria-hidden="true" size={14} />}
      </button>
      <button
        aria-label="Cancelar Pomodoro"
        className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-error-container hover:text-error"
        onClick={() => void cancel()}
        type="button"
      >
        <Square aria-hidden="true" size={13} />
      </button>
    </div>
  );
}
