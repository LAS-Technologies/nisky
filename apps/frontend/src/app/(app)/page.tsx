"use client";

import Image from "next/image";
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
import { useAuth } from "@/context/AuthProvider";
import "@/components/home/home.css";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [habitManagerOpen, setHabitManagerOpen] = useState(false);
  const capture = useCapture();
  const overviewQuery = useHomeOverviewQuery();
  const activityQuery = useHomeActivityQuery();
  const matrixQuery = useHabitsMatrixQuery();
  const taskMutations = useTaskMutations();
  const habitMutations = useHabitMutations();
  const overview = overviewQuery.data;
  const blockTaskIds = new Set((overview?.todayTasks ?? []).map((task) => task.id));
  const urgentTasks = getTodayUrgentTasks(overview?.urgentTasks ?? [], 10).filter((task) => !blockTaskIds.has(task.id));
  const todayLabel = new Intl.DateTimeFormat("es-DO", {
    day: "numeric", month: "long", weekday: "long",
  }).format(new Date());
  const firstName = user?.name?.trim().split(/\s+/)[0] || "bienvenido";

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

  const handlePlayPomodoro = (taskId?: string, projectId?: string, timeBlockId?: string, timeBlockDate?: string) => {
    const params = new URLSearchParams();
    if (taskId) params.set("taskId", taskId);
    if (projectId) params.set("projectId", projectId);
    if (timeBlockId) params.set("timeBlockId", timeBlockId);
    if (timeBlockDate) params.set("timeBlockDate", timeBlockDate);
    router.push(params.toString() ? `/focus?${params.toString()}` : "/focus");
  };

  return (
    <section className="home-dashboard h-full overflow-y-auto" aria-label="Inicio">
      <div className="home-content">
        <header className="home-welcome">
          <div className="home-greeting">
            <p className="home-date">{todayLabel}</p>
            <h1>Hola, {firstName}</h1>
            <p className="home-purpose">Un día bien organizado te acerca a tus objetivos.<br />¿Qué quieres cuidar hoy?</p>
          </div>
          <div className="home-illustration" aria-hidden="true">
            <Image alt="" src="/design-official/otter-at-desk.png" width={324} height={162} priority />
          </div>
        </header>

        <button aria-label="Abrir captura rápida" className="home-capture" onClick={() => capture.open("TASK")} type="button">
          <span className="home-capture-plus"><Plus size={24} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">¿Qué quieres agregar hoy? <span className="hidden sm:inline">(tarea, nota, recordatorio...)</span></span>
          <kbd className="home-shortcut">Alt+N</kbd>
          <span className="home-capture-arrow"><ArrowRight size={20} aria-hidden="true" /></span>
        </button>

        {overviewQuery.isError && (
          <div className="home-card flex flex-wrap items-center justify-between gap-3 text-error" role="alert">
            <p>No pudimos cargar el resumen de hoy.</p>
            <button className="min-h-11 px-3 underline" onClick={() => void overviewQuery.refetch()} type="button">Reintentar</button>
          </div>
        )}

        {overviewQuery.isPending ? (
          <div aria-label="Cargando resumen de hoy" className="home-grid" role="status">
            {[0, 1, 2, 3].map((key) => <div key={key} className="home-card min-h-[298px] animate-pulse bg-surface-container-low" />)}
          </div>
        ) : overview ? (
          <div className="home-grid">
            <div className="home-block">
              <ActiveBlockBanner
                activeEvent={overview.activeEvent ?? null}
                block={overview.activeBlock ?? null}
                nextBlock={overview.nextBlock ?? null}
                nextBlockStart={overview.nextBlockStart ?? null}
                onPlayPomodoro={handlePlayPomodoro}
                onToggleTask={(task) => void toggleTask(task)}
                tasks={overview.blockTasks ?? []}
              />
            </div>
            <HomeHabitsSummary
              isLoading={matrixQuery.isLoading}
              isError={matrixQuery.isError}
              matrix={matrixQuery.data}
              onOpenManager={() => setHabitManagerOpen(true)}
              onRetry={() => void matrixQuery.refetch()}
              onToggle={(habitId, date) => {
                void habitMutations.toggleEntry.mutateAsync({ id: habitId, date }).catch(() => {
                  toast.error("No pudimos actualizar el hábito.");
                });
              }}
            />
            <TodayTasksPanel
              emptyMessage="Tu agenda está limpia. Elige una intención pequeña para empezar."
              blockTasks={overview.todayTasks ?? []}
              onCreateTask={() => capture.open("TASK")}
              onToggle={(task) => void toggleTask(task)}
              tasks={urgentTasks}
            />
            <FutureView blocks={overview.futureBlocks} tasks={overview.futureTasks} />
          </div>
        ) : null}

        <details className="home-extra">
          <summary className="cursor-pointer rounded-md py-3 font-body-sm text-body-sm text-on-surface-variant">Tu actividad y capturas rápidas</summary>
          <div className="grid gap-6 pt-3 lg:grid-cols-2">
            <QuickNotesPanel />
            <ActivityHeatmap activity={activityQuery.data} isError={activityQuery.isError} isLoading={activityQuery.isPending} onRetry={() => void activityQuery.refetch()} />
          </div>
        </details>
      </div>
      <div className="sm:hidden">
        <FAB ariaLabel="Nueva tarea" onClick={() => capture.open("TASK")} raised={capture.isOpen} />
      </div>
      {habitManagerOpen && <HabitManager onClose={() => setHabitManagerOpen(false)} />}
    </section>
  );
}
