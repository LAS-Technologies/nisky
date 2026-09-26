"use client";

import { Check, MoreHorizontal, Target } from "lucide-react";
import { localDateKey } from "@/lib/utils";
import type { HabitsMatrix } from "@/types/entities";
import { HomeCardHeader } from "./HomeCardHeader";

export function HomeHabitsSummary({ matrix, isLoading, isError, onRetry, onToggle, onOpenManager }: {
  matrix: HabitsMatrix | undefined;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onToggle: (habitId: string, date: string) => void;
  onOpenManager: () => void;
}) {
  const todayKey = localDateKey(new Date());
  const habits = (matrix?.habits ?? []).filter((habit) => habit.isDueToday);
  const completedToday = habits.filter((habit) => habit.todayCompleted).length;
  return (
    <section className="home-card home-habits" aria-label="Hábitos de hoy">
      <HomeCardHeader icon={Target} title="Hábitos de hoy" subtitle="Tu ritmo diario" action={
        <button aria-label="Gestionar hábitos" className="home-icon-action" onClick={onOpenManager} type="button"><MoreHorizontal size={18} /></button>
      } />
      <span className="sr-only" aria-live="polite">{completedToday} de {habits.length} completados</span>
      {isLoading ? (
        <div aria-label="Cargando hábitos" className="mt-4 h-40 animate-pulse rounded-md bg-surface-container-low" role="status" />
      ) : isError ? (
        <div className="py-5 font-body-sm text-body-sm text-error" role="alert">
          <p>No pudimos cargar tus hábitos.</p>
          {onRetry && <button className="mt-2 min-h-11 underline" onClick={onRetry} type="button">Reintentar</button>}
        </div>
      ) : !matrix?.habits.length ? (
        <div className="flex min-h-[196px] flex-col items-start justify-center gap-3">
          <p className="font-body-sm text-body-sm text-on-surface-variant">Crea un hábito pequeño y cuídalo cada día.</p>
          <button className="min-h-11 rounded-sm border border-outline-variant px-3 text-[13px] text-primary hover:bg-surface-container-low" onClick={onOpenManager} type="button">Crear primer hábito</button>
        </div>
      ) : habits.length === 0 ? (
        <p className="py-6 font-body-sm text-body-sm text-on-surface-variant">No hay hábitos programados para hoy.</p>
      ) : (
        <div>
          {habits.map((habit) => (
            <div className="home-habit-row" key={habit.id}>
              <button aria-label={`${habit.todayCompleted ? "Marcar pendiente" : "Completar"} ${habit.name}`} aria-pressed={habit.todayCompleted} className="home-check-button" onClick={() => onToggle(habit.id, todayKey)} type="button">
                <span className="home-checkbox" data-checked={habit.todayCompleted}><Check size={14} aria-hidden="true" /></span>
              </button>
              <span className="min-w-0 flex-1 break-words text-[15px] leading-[22px]" title={`Racha: ${habit.streak} días`}>{habit.name}</span>
              <button aria-label={`Gestionar ${habit.name}`} className="home-icon-action" onClick={onOpenManager} type="button"><MoreHorizontal size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
