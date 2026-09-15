"use client";

import Link from "next/link";
import { localDateKey } from "@/lib/utils";
import { minToTime } from "@/features/timeblocks/lib/time";
import type { Project, Task, TimeBlockWithProject } from "@/types/entities";

type FutureBlock = TimeBlockWithProject & { date?: string };

function dayLabel(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short" }).format(date);
}

function futureDayKey(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return localDateKey(date);
}

export function FutureView({
  tasks,
  blocks,
}: {
  tasks: (Task & { project: Project | null })[];
  blocks: FutureBlock[];
}) {
  const tomorrowKey = futureDayKey(1);
  const dayAfterKey = futureDayKey(2);

  const days = [
    { key: tomorrowKey, label: "Mañana", title: dayLabel(1) },
    { key: dayAfterKey, label: "Pasado mañana", title: dayLabel(2) },
  ];

  return (
    <section className="space-y-5 rounded-lg border border-outline-variant bg-surface-container-lowest p-container-padding shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-outline-variant pb-3">
        <div>
          <h2 className="font-headline-xs text-headline-xs font-bold text-on-surface">Próximos días</h2>
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Tu siguiente ritmo</p>
        </div>
        <Link className="font-label-caps text-label-caps text-primary hover:underline" href="/timeblocks">
          AGENDA <span aria-hidden="true">→</span>
        </Link>
      </header>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.dueDate && localDateKey(task.dueDate) === day.key).slice(0, 3);
          const dayBlocks = blocks
            .filter((block) => {
              if (block.date) return block.date === day.key;
              if (block.recurrenceStartsAt && block.recurrenceStartsAt.slice(0, 10) > day.key) return false;
              return block.daysOfWeek.includes(new Date(`${day.key}T12:00:00.000Z`).getDay());
            })
            .sort((a, b) => a.startMin - b.startMin);
          return (
            <div className="space-y-2" key={day.key}>
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h3 className="font-headline-xs text-headline-xs font-semibold text-on-surface">{day.label}</h3>
                <p className="capitalize font-data-mono text-data-mono text-xs text-on-surface-variant">{day.title}</p>
              </div>
              <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
                <div className="space-y-3">
                  {dayBlocks.length === 0 ? (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Sin bloques</p>
                  ) : (
                    <ul className="space-y-2">
                      {dayBlocks.map((block) => (
                        <li className="flex items-center gap-2 font-body-sm text-body-sm" key={block.id}>
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: block.project?.color ?? "#0f172a" }} />
                          <span className="truncate">{block.name ?? block.project?.name ?? "Tiempo libre"}</span>
                          <span className="ml-auto shrink-0 font-data-mono text-data-mono text-xs text-on-surface-variant">
                            {minToTime(block.startMin)}–{minToTime(block.endMin)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {dayBlocks.length > 0 && dayTasks.length > 0 && <div className="border-t border-outline-variant/70" />}

                  {dayTasks.length === 0 ? (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Sin tareas</p>
                  ) : (
                    <ul className="space-y-2">
                      {dayTasks.map((task) => (
                        <li className="flex items-center gap-2 font-body-sm text-body-sm" key={task.id}>
                          {task.project && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />}
                          <Link className="line-clamp-1 min-w-0 flex-1 hover:text-primary" href={`/tasks?taskId=${encodeURIComponent(task.id)}`}>
                            {task.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
