import type { PomodoroPhase } from "@/types/entities";
import { PhaseBadge } from "./PhaseBadge";

function clock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function TimerDisplay({ remainingSec, phase, pomodorosCompleted, pomodorosEstimated }: { remainingSec: number; phase: PomodoroPhase; pomodorosCompleted: number | null; pomodorosEstimated: number | null }) {
  const progressLabel = pomodorosCompleted === null || pomodorosEstimated === null
    ? "Selecciona una tarea para ver tu progreso"
    : `Pomodoros: ${pomodorosCompleted} de ${pomodorosEstimated}`;

  return <div className="focus-clock flex flex-col items-center gap-4"><PhaseBadge phase={phase} /><div aria-live="polite" className="select-none font-data-mono text-[clamp(5rem,18vw,8rem)] font-medium leading-none tracking-[-0.05em] text-primary">{clock(remainingSec)}</div><span className="font-data-mono text-data-mono text-sm text-on-surface-variant">{progressLabel}</span></div>;
}
