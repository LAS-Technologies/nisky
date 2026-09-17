"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { FAB } from "@/components/ui/FAB";
import { ActiveBlockBanner } from "@/components/home/ActiveBlockBanner";
import { ActivityHeatmap } from "@/components/home/ActivityHeatmap";
import { FutureView } from "@/components/home/FutureView";
import { HomeHabitsSummary } from "@/components/home/HomeHabitsSummary";
import { QuickNotesPanel } from "@/components/home/QuickNotesPanel";
import { TodayTasksPanel, getTodayUrgentTasks } from "@/components/home/TodayTasksPanel";
import { useHabitMutations } from "@/features/habits/hooks/useHabits";
import { HabitManager } from "@/features/habits/components/HabitManager";
import { useHomeActivityQuery, useHomeOverviewQuery, useHabitsMatrixQuery } from "@/features/home/hooks/useHome";
import { useTaskMutations } from "@/features/tasks/hooks/useTasks";
import type { Task } from "@/types/entities";
import { useCapture } from "@/context/CaptureContext";
import { UniversityIntegrationBanner } from "@/components/home/UniversityIntegrationBanner";

export default function DashboardPage() {
  const router = useRouter();
  const [habitManagerOpen, setHabitManagerOpen] = useState(false);
  const capture = useCapture();

  const overviewQuery = useHomeOverviewQuery();
  const activityQuery = useHomeActivityQuery();
  const matrixQuery = useHabitsMatrixQuery();
  const taskMutations = useTaskMutations();
  const habitMutations = useHabitMutations();

  const overview = overviewQuery.data;
  const activeBlock = overview?.activeBlock ?? null;
  const blockTaskIds = new Set((overview?.todayTasks ?? []).map((task) => task.id));
  const urgentTasks = getTodayUrgentTasks(overview?.urgentTasks ?? [], 10).filter(
    (task) => !blockTaskIds.has(task.id),
  );
  const todayLabel = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date());

  const toggleTask = async (task: Task) => {
    try {
      await taskMutations.update.mutateAsync({
        id: task.id,
        payload: { status: task.status === "COMPLETED" ? "PENDING" : "COMPLETED" },
      });
    } catch {
      toast.error("Ups, no pudimos actualizar la tarea.");
    }
  };

  const handlePlayPomodoro = (
    taskId?: string,
    projectId?: string,
    timeBlockId?: string,
    timeBlockDate?: string,
  ) => {
    const params = new URLSearchParams();
    if (taskId) params.set("taskId", taskId);
    if (projectId) params.set("projectId", projectId);
    if (timeBlockId) params.set("timeBlockId", timeBlockId);
    if (timeBlockDate) params.set("timeBlockDate", timeBlockDate);
    router.push(params.toString() ? `/focus?${params.toString()}` : "/focus");
  };

  return (
    <section className="flex h-full flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-container-padding pb-24 sm:gap-8 sm:px-6 sm:py-8 lg:px-10">
          <header className="space-y-4">
            <div>
              <p className="whitespace-nowrap font-label-caps text-label-caps uppercase tracking-[0.08em] text-on-surface-variant">{todayLabel}</p>
              <h1 className="mt-1 font-display-hero-mobile font-bold text-on-surface sm:font-display-hero">Hoy</h1>
            </div>
            <button
              aria-label="Abrir captura rápida"
              className="group flex min-h-14 w-full items-center gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-left shadow-sm transition-colors hover:border-secondary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:px-4"
              onClick={() => capture.open("TASK")}
              type="button"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary-fixed bg-primary-fixed text-secondary transition-colors group-hover:bg-secondary group-hover:text-on-secondary">
                <Plus size={17} strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1 font-body-md text-body-md text-on-surface-variant">
                Añadir tarea, idea o nota rápida...
              </span>
              <kbd className="hidden border border-outline-variant bg-surface-container-low px-1.5 py-0.5 font-data-mono text-[10px] text-on-surface-variant sm:inline-block">
                Alt+N
              </kbd>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary sm:flex">
                <ArrowRight size={15} />
              </span>
            </button>
          </header>

          {overviewQuery.isError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-error-container px-4 py-3 text-on-error-container" role="alert">
              <p className="font-body-sm text-body-sm">No pudimos cargar el resumen de hoy.</p>
              <button
                 className="rounded-md px-2 py-1 font-label-caps text-label-caps underline underline-offset-2 hover:bg-error-container/40"
                onClick={() => void overviewQuery.refetch()}
                type="button"
              >
                REINTENTAR
              </button>
            </div>
          )}

          <UniversityIntegrationBanner />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="min-w-0 space-y-6 lg:col-span-7">
              <ActiveBlockBanner
                activeEvent={overview?.activeEvent ?? null}
                block={activeBlock}
                nextActivity={overview?.nextActivity ?? null}
                onPlayPomodoro={handlePlayPomodoro}
                onToggleTask={(task) => void toggleTask(task)}
                tasks={overview?.blockTasks ?? []}
              />
              <TodayTasksPanel
                emptyMessage="Nada pendiente. ¡Todo al día!"
                blockTasks={overview?.todayTasks ?? []}
                onToggle={(task) => void toggleTask(task)}
                tasks={urgentTasks}
              />
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-5">
              <HomeHabitsSummary
                isLoading={matrixQuery.isLoading}
                matrix={matrixQuery.data}
                onOpenManager={() => setHabitManagerOpen(true)}
                onToggle={(habitId, date) => {
                  void habitMutations.toggleEntry.mutateAsync({ id: habitId, date });
                }}
              />
              <QuickNotesPanel />
              <FutureView blocks={overview?.futureBlocks ?? []} tasks={overview?.futureTasks ?? []} />
              <ActivityHeatmap activity={activityQuery.data} />
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden">
        <FAB ariaLabel="Nueva tarea" onClick={() => capture.open("TASK")} raised={capture.isOpen} />
      </div>

      {habitManagerOpen && <HabitManager onClose={() => setHabitManagerOpen(false)} />}
    </section>
  );
}
