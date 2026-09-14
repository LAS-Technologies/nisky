"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Settings, Timer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type {
  PomodoroPhase,
  PomodoroSession,
  PomodoroSettings,
} from "@/types/entities";
import { TaskFocusDetails } from "@/features/pomodoro/components/TaskFocusDetails";
import { TaskPagination } from "@/features/tasks/components/TaskPagination";
import {
  useActiveTasksQuery,
  useTaskMutations,
  useTaskQuery,
} from "@/features/tasks/hooks/useTasks";
import { useProjectsQuery } from "@/features/projects/hooks/useProjects";
import {
  useActiveBlockQuery,
  useTimeBlocksQuery,
} from "@/features/timeblocks/hooks/useTimeBlocks";
import { useTaskSchedulesQuery } from "@/features/task-schedules/hooks/useTaskSchedules";
import { Controls } from "@/features/pomodoro/components/Controls";
import { SessionList } from "@/features/pomodoro/components/SessionList";
import { SettingsModal } from "@/features/pomodoro/components/SettingsModal";
import { TimerDisplay } from "@/features/pomodoro/components/TimerDisplay";
import {
  usePomodoroMutations,
  usePomodoroSessionsQuery,
  usePomodoroSettingsQuery,
} from "@/features/pomodoro/hooks/usePomodoro";
import { playCompletionSound } from "@/features/pomodoro/lib/sound";
import { openPomodoroWindow, supportsDocumentPictureInPicture } from "@/features/pomodoro/lib/window";
import { usePomodoro } from "@/context/PomodoroProvider";
import { localDateKey } from "@/lib/utils";

const fallbackSettings: PomodoroSettings = {
  workSec: 1500,
  shortBreakSec: 300,
  longBreakSec: 900,
  cyclesPerLong: 4,
  autoCycle: false,
  soundEnabled: true,
};

const FOCUS_PROJECT_KEY = "nisky:focus-project";

function secondsForPhase(phase: PomodoroPhase, settings: PomodoroSettings) {
  if (phase === "SHORT_BREAK") return settings.shortBreakSec;
  if (phase === "LONG_BREAK") return settings.longBreakSec;
  return settings.workSec;
}

function FocusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskIdFromUrl = searchParams.get("taskId");
  const projectIdFromUrl = searchParams.get("projectId");
  const timeBlockIdFromUrl = searchParams.get("timeBlockId");
  const todayKey = localDateKey(new Date());
  const requestedScheduleDate = searchParams.get("timeBlockDate");
  const scheduleDate = requestedScheduleDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedScheduleDate)
    ? requestedScheduleDate
    : todayKey;
  const settingsQuery = usePomodoroSettingsQuery();
  const sessionsQuery = usePomodoroSessionsQuery({ limit: 8 });
  const projectsQuery = useProjectsQuery();
  const activeBlockQuery = useActiveBlockQuery();
  const timeBlocksQuery = useTimeBlocksQuery();
  const focusTimeBlock = timeBlockIdFromUrl
    ? timeBlocksQuery.data?.find((block) => block.id === timeBlockIdFromUrl) ?? null
    : null;
  const [selectedProjectId, setSelectedProjectId] = useState(
    projectIdFromUrl ?? "",
  );
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const tasksQuery = useActiveTasksQuery({
    ...(showAllTasks ? {} : { projectId: selectedProjectId || undefined }),
    page: taskPage,
  });
  const schedulesQuery = useTaskSchedulesQuery({
    from: scheduleDate,
    to: scheduleDate,
  });
  const selectedTaskQuery = useTaskQuery(taskIdFromUrl);
  const mutations = usePomodoroMutations();
  const taskMutations = useTaskMutations();
  const globalPomodoro = usePomodoro();
  const settings = settingsQuery.data ?? fallbackSettings;
  const projects = projectsQuery.data ?? [];
  const activeBlockId = activeBlockQuery.data?.id;
  const [phase, setPhase] = useState<PomodoroPhase>("WORK");
  const [cycleIndex, setCycleIndex] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState(taskIdFromUrl ?? "");
  const [session, setSession] = useState<PomodoroSession | null | undefined>(
    undefined,
  );
  const [now, setNow] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const completionInFlight = useRef(false);
  const skipInFlight = useRef(false);
  const lastCompletedIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const assignedBlockTasks = (schedulesQuery.data ?? [])
    .filter((schedule) => schedule.occurrence?.occurs !== false)
    .filter(
      (schedule) =>
        (timeBlockIdFromUrl
          ? schedule.timeBlockId === timeBlockIdFromUrl
          : !selectedProjectId || schedule.task.projectId === selectedProjectId),
    )
    .sort(
      (a, b) =>
        Number(b.timeBlockId === activeBlockId) -
          Number(a.timeBlockId === activeBlockId) || a.order - b.order,
    )
    .map((schedule) => schedule.task);
  const fallbackTasks = tasksQuery.data?.data ?? [];
  const tasks = (
    showAllTasks || assignedBlockTasks.length === 0
      ? fallbackTasks
      : assignedBlockTasks
  ).filter(
    (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
  );

  useEffect(() => {
    if (initializedRef.current) return;
    const candidates = [
      projectIdFromUrl ?? undefined,
      focusTimeBlock?.projectId ?? undefined,
      activeBlockQuery.data?.projectId ?? undefined,
      typeof window !== "undefined"
        ? (localStorage.getItem(FOCUS_PROJECT_KEY) ?? undefined)
        : undefined,
      (projectsQuery.data ?? []).find((project) => project.isDefault)?.id,
    ].filter(Boolean) as string[];
    const initial = candidates[0];
    if (initial) {
      initializedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fijar el proyecto inicial solo en la primera carga (comportamiento deliberado)
      setSelectedProjectId(initial);
    }
  }, [
    projectIdFromUrl,
    focusTimeBlock?.projectId,
    activeBlockQuery.data?.projectId,
    projectsQuery.data,
    selectedProjectId,
  ]);

  useEffect(() => {
    if (!selectedProjectId) return;
    localStorage.setItem(FOCUS_PROJECT_KEY, selectedProjectId);
  }, [selectedProjectId]);

  // Start with the first task assigned to the selected block when available.
  useEffect(() => {
    if (!timeBlockIdFromUrl) return;
    if (selectedTaskId) return;
    const blockTask = assignedBlockTasks.find(
      (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
    );
    if (blockTask) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la tarea inicial con el bloque solicitado
      setSelectedTaskId(blockTask.id);
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      params.set("taskId", blockTask.id);
      if (timeBlockIdFromUrl) params.set("timeBlockId", timeBlockIdFromUrl);
      if (requestedScheduleDate) params.set("timeBlockDate", requestedScheduleDate);
      router.replace(`/focus?${params.toString()}`);
    }
  }, [
    timeBlockIdFromUrl,
    requestedScheduleDate,
    assignedBlockTasks,
    selectedProjectId,
    selectedTaskId,
    router,
  ]);

  useEffect(() => {
    if (selectedTaskId) return;
    if (!lastCompletedIdRef.current) return;
    const list = tasks;
    const pending = list.filter(
      (task) => task.id !== lastCompletedIdRef.current,
    );
    if (pending.length === 0) return;
    const next = pending[0];
    setSelectedTaskId(next.id);
    const params = new URLSearchParams();
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    params.set("taskId", next.id);
    router.replace(`/focus?${params.toString()}`);
  }, [tasks, selectedProjectId, router, selectedTaskId]);
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ??
    (taskIdFromUrl ? selectedTaskQuery.data : null) ??
    null;
  const currentSession =
    session === undefined
      ? (globalPomodoro.activeSession ??
        sessionsQuery.data?.data.find(
          (item) => item.status === "ACTIVE" || item.status === "PAUSED",
        ) ??
        null)
      : session;
  const displayPhase = currentSession?.phase ?? phase;
  const remainingSec = currentSession
    ? Math.max(
        0,
        currentSession.plannedSec -
          Math.floor(
            (now - new Date(currentSession.startedAt).getTime()) / 1000,
          ) +
          currentSession.totalPausedSec +
          (currentSession.pausedAt
            ? Math.floor(
                (now - new Date(currentSession.pausedAt).getTime()) / 1000,
              )
            : 0),
      )
    : secondsForPhase(phase, settings);
  const running = Boolean(currentSession);
  const paused = currentSession?.status === "PAUSED";

  useEffect(() => {
    if (!currentSession || currentSession.status !== "ACTIVE") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentSession]);

  const startPhase = useCallback(
    async (nextPhase: PomodoroPhase, nextCycleIndex: number) => {
      try {
        const started = await mutations.start.mutateAsync({
          phase: nextPhase,
          taskId: nextPhase === "WORK" ? selectedTaskId || null : null,
          cycleIndex: nextCycleIndex,
        });
        setPhase(nextPhase);
        setCycleIndex(nextCycleIndex);
        setSession(started);
        globalPomodoro.setActiveSession(started);
        setNow(Date.now());
        return true;
      } catch {
        toast.error("Ups, no pudimos iniciar el Pomodoro.");
        return false;
      }
    },
    [globalPomodoro, mutations.start, selectedTaskId],
  );

  const openPomodoroWindowManually = () => {
    if (supportsDocumentPictureInPicture()) {
      void globalPomodoro.openPictureInPicture().then((opened) => {
        if (!opened && !openPomodoroWindow()) {
          toast.error("El navegador bloqueó la ventana del Pomodoro.");
        }
      });
      return;
    }
    if (!openPomodoroWindow()) toast.error("El navegador bloqueó la ventana del Pomodoro.");
  };

  const completeSession = useCallback(async () => {
    if (!currentSession || completionInFlight.current) return;
    completionInFlight.current = true;
    try {
      await mutations.action.mutateAsync({
        id: currentSession.id,
        action: "COMPLETE",
      });
      playCompletionSound(settings.soundEnabled);
      toast.success(
        currentSession.phase === "WORK"
          ? "¡Buen trabajo! Pomodoro completado"
          : "Descanso terminado. ¿Listo para el siguiente?",
      );
      const nextPhase =
        currentSession.phase === "WORK"
          ? currentSession.cycleIndex >= settings.cyclesPerLong
            ? "LONG_BREAK"
            : "SHORT_BREAK"
          : "WORK";
      const nextCycle =
        currentSession.phase === "SHORT_BREAK"
          ? currentSession.cycleIndex + 1
          : currentSession.phase === "LONG_BREAK"
            ? 1
            : currentSession.cycleIndex;
      setPhase(nextPhase);
      setCycleIndex(nextCycle);
      setSession(null);
      globalPomodoro.clearActiveSession();
      if (settings.autoCycle) await startPhase(nextPhase, nextCycle);
    } catch {
      toast.error(
        "Ups, no pudimos guardar el Pomodoro completado. Inténtalo de nuevo.",
      );
    } finally {
      completionInFlight.current = false;
    }
  }, [currentSession, globalPomodoro, mutations.action, settings, startPhase]);

  useEffect(() => {
    if (currentSession?.status !== "ACTIVE" || remainingSec > 0)
      return undefined;
    const completion = window.setTimeout(() => void completeSession(), 0);
    return () => window.clearTimeout(completion);
  }, [completeSession, currentSession, remainingSec]);

  const pauseResume = async () => {
    if (!currentSession) return;
    try {
      const updated = await mutations.action.mutateAsync({
        id: currentSession.id,
        action: paused ? "RESUME" : "PAUSE",
      });
      setSession(updated);
      globalPomodoro.setActiveSession(updated);
      setNow(Date.now());
    } catch {
      toast.error("Ups, algo falló al pausar o reanudar. Inténtalo de nuevo.");
    }
  };

  const stop = async () => {
    if (!currentSession) return;
    try {
      await mutations.action.mutateAsync({
        id: currentSession.id,
        action: "CANCEL",
      });
      setSession(null);
      globalPomodoro.clearActiveSession();
      toast.success("¡Listo, detuvimos el Pomodoro!");
    } catch {
      toast.error("Ups, no pudimos detener el Pomodoro.");
    }
  };

  const skipBreak = async () => {
    if (!currentSession || currentSession.phase === "WORK" || skipInFlight.current) return;
    skipInFlight.current = true;
    const nextCycle = currentSession.phase === "SHORT_BREAK" ? currentSession.cycleIndex + 1 : 1;
    try {
      await mutations.action.mutateAsync({
        id: currentSession.id,
        action: "CANCEL",
      });
      setPhase("WORK");
      setCycleIndex(nextCycle);
      setSession(null);
      globalPomodoro.clearActiveSession();
      if (await startPhase("WORK", nextCycle)) {
        toast.success("Descanso omitido. Comenzamos el siguiente Pomodoro.");
      }
    } catch {
      toast.error("Ups, no pudimos saltar el descanso. Inténtalo de nuevo.");
    } finally {
      skipInFlight.current = false;
    }
  };

  const handleProjectChange = (projectId: string) => {
    setTaskPage(1);
    setSelectedProjectId(projectId);
    setSelectedTaskId("");
    setShowAllTasks(false);
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    router.replace(
      params.toString() ? `/focus?${params.toString()}` : "/focus",
    );
  };

  const completeTask = async () => {
    if (!selectedTask) return;
    const completedId = selectedTask.id;
    try {
      await taskMutations.update.mutateAsync({
        id: completedId,
        payload: { status: "COMPLETED" },
      });
      lastCompletedIdRef.current = completedId;
      toast.success("¡Tarea completada!");
      setSelectedTaskId("");
      if (taskIdFromUrl) {
        const params = new URLSearchParams();
        if (selectedProjectId) params.set("projectId", selectedProjectId);
        router.replace(
          params.toString() ? `/focus?${params.toString()}` : "/focus",
        );
      }
    } catch {
      toast.error("Ups, no pudimos completar la tarea. Inténtalo de nuevo.");
    }
  };

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-surface px-4 py-6 sm:px-8 sm:py-10">
      <button
        className="absolute left-4 top-4 flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface-variant hover:border-outline hover:text-primary sm:left-6 sm:top-6"
        onClick={() => router.push("/")}
        type="button"
      >
        <ArrowLeft size={16} /> Salir del modo
      </button>
      <button
        aria-label="Configuración Pomodoro"
        className="absolute right-4 top-4 rounded-md border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant hover:border-outline hover:text-primary sm:right-6 sm:top-6"
        onClick={() => setSettingsOpen(true)}
        type="button"
      >
        <Settings size={17} />
      </button>
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 pt-16 sm:gap-12 sm:pt-10">
        <div className="flex w-full flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              ENFOQUE
            </span>
            {timeBlockIdFromUrl && focusTimeBlock && !showAllTasks && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-label-caps text-[10px] uppercase text-primary">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                Bloque: {focusTimeBlock.name ?? "Enfoque"}
              </span>
            )}
            {activeBlockQuery.data?.projectId &&
              activeBlockQuery.data.projectId === selectedProjectId &&
              !showAllTasks && !timeBlockIdFromUrl && (
                <span className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-0.5 font-label-caps text-[10px] uppercase text-primary">
                  Bloque activo
                </span>
              )}
          </div>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              PROYECTO
            </span>
            <select
              aria-label="Seleccionar proyecto"
              className="field mt-1 w-full"
              disabled={running}
              onChange={(event) => handleProjectChange(event.target.value)}
              value={selectedProjectId}
            >
              {projects.length === 0 && <option value="">Sin proyectos</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              TAREA
            </span>
            <select
              aria-label="Seleccionar tarea"
              className="field mt-1 w-full"
              disabled={running}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              value={selectedTaskId}
            >
              <option value="">
                {tasks.length === 0
                  ? "No hay tareas en este proyecto"
                  : "Elige una tarea para empezar"}
              </option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          {tasksQuery.data &&
            (showAllTasks || assignedBlockTasks.length === 0) && (
              <TaskPagination
                isFetching={tasksQuery.isFetching}
                meta={tasksQuery.data.meta}
                onPageChange={setTaskPage}
              />
            )}
        </div>
        {selectedTask && (
          <TaskFocusDetails
            disabled={running}
            key={selectedTask.id}
            onComplete={completeTask}
            task={selectedTask}
          />
        )}
        <TimerDisplay
          phase={displayPhase}
          pomodorosCompleted={selectedTask?.pomodoroCount ?? null}
          pomodorosEstimated={selectedTask?.pomodoroEstimate ?? null}
          remainingSec={remainingSec}
        />
        <Controls
          onCompletePomodoro={() => void completeSession()}
          onPause={() => void pauseResume()}
          onResume={() => void pauseResume()}
          onSkipBreak={() => void skipBreak()}
          onOpenPomodoroWindow={openPomodoroWindowManually}
          onStart={() => void startPhase(phase, cycleIndex)}
          onStop={() => void stop()}
          paused={Boolean(paused)}
          phase={displayPhase}
          running={running}
        />
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <div className="flex items-center justify-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <Timer size={15} />{" "}
            {settings.autoCycle
              ? "Pasar al descanso automáticamente"
              : "Tú decides cuándo descansar"}
          </div>
          <SessionList sessions={sessionsQuery.data?.data ?? []} />
        </div>
      </div>
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          settings={settings}
        />
      )}
    </main>
  );
}

export default function FocusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface font-body-sm text-body-sm text-on-surface-variant">
          Cargando modo enfoque...
        </div>
      }
    >
      <FocusPageContent />
    </Suspense>
  );
}
