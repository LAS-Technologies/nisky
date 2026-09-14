import { CheckCircle2, Pause, PictureInPicture, Play, SkipForward, Square } from "lucide-react";
import type { PomodoroPhase } from "@/types/entities";

const PRIMARY: Record<PomodoroPhase, string> = {
  WORK: "rounded-lg bg-primary-container text-on-primary hover:bg-primary",
  SHORT_BREAK: "rounded-lg bg-secondary-container text-on-secondary-container hover:opacity-90",
  LONG_BREAK: "rounded-lg bg-tertiary-fixed text-on-tertiary-fixed hover:opacity-90",
};

const SECONDARY = "rounded-lg border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high";

export function Controls({ running, paused, phase, onStart, onPause, onResume, onStop, onSkipBreak, onCompletePomodoro, onOpenPomodoroWindow }: { running: boolean; paused: boolean; phase: PomodoroPhase; onStart: () => void; onPause: () => void; onResume: () => void; onStop: () => void; onSkipBreak: () => void; onCompletePomodoro: () => void; onOpenPomodoroWindow?: () => void }) {
  const breakPhase = phase !== "WORK";
  if (!running) {
    const startLabel = phase === "SHORT_BREAK" ? "Iniciar descanso corto" : phase === "LONG_BREAK" ? "Iniciar descanso largo" : "Iniciar Pomodoro";
    return (
      <button
        className={`flex w-full max-w-md items-center justify-center gap-2 px-6 py-4 font-body-md text-body-md ${PRIMARY[phase]}`}
        onClick={onStart}
        type="button"
      >
        <Play size={18} /> {startLabel}
      </button>
    );
  }
  const pauseResumeLabel = paused ? (breakPhase ? "Reanudar descanso" : "Reanudar") : (breakPhase ? "Pausar descanso" : "Pausar");
  const cancelLabel = breakPhase ? "Saltar descanso" : "Cancelar Pomodoro";
  const cancelTitle = breakPhase ? "Saltar este descanso y comenzar el siguiente Pomodoro" : "Cancelar este Pomodoro; no contará como completado";
  const completeLabel = breakPhase ? "Empezar a trabajar" : "Completar Pomodoro";
  const CompleteIcon = breakPhase ? SkipForward : CheckCircle2;
  return (
    <div className="flex w-full max-w-md flex-wrap items-center gap-3">
      <button
        aria-label={pauseResumeLabel}
        className={`flex min-w-[130px] flex-1 items-center justify-center gap-2 border px-5 py-4 font-body-md text-body-md ${SECONDARY}`}
        onClick={paused ? onResume : onPause}
        title={paused ? (breakPhase ? "Continuar este descanso" : "Continuar este Pomodoro") : (breakPhase ? "Pausar este descanso temporalmente" : "Pausar temporalmente; podrás continuar después")}
        type="button"
      >
        {paused ? <Play size={18} /> : <Pause size={18} />} {pauseResumeLabel}
      </button>
      <button
        aria-label={cancelLabel}
        className={`flex min-w-[130px] flex-1 items-center justify-center gap-2 border px-5 py-4 font-body-md text-body-md ${SECONDARY}`}
        onClick={breakPhase ? onSkipBreak : onStop}
        title={cancelTitle}
        type="button"
      >
        {breakPhase ? <SkipForward size={18} /> : <Square size={18} />} {cancelLabel}
      </button>
      <button
        className={`flex w-full items-center justify-center gap-2 px-5 py-4 font-body-md text-body-md ${PRIMARY[phase]}`}
        onClick={onCompletePomodoro}
        type="button"
      >
        <CompleteIcon size={18} /> {completeLabel}
      </button>
      {onOpenPomodoroWindow && (
        <button
          aria-label="Abrir Pomodoro en una ventana separada"
          className={`flex w-full items-center justify-center gap-2 border px-5 py-3 font-body-sm text-body-sm ${SECONDARY}`}
          onClick={onOpenPomodoroWindow}
          type="button"
        >
          <PictureInPicture size={16} /> Abrir ventana del Pomodoro
        </button>
      )}
    </div>
  );
}
