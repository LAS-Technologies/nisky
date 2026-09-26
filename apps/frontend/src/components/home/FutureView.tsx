"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MoreHorizontal } from "lucide-react";
import { localDateKey } from "@/lib/utils";
import { minToTime } from "@/features/timeblocks/lib/time";
import type { Project, Task, TimeBlockWithProject } from "@/types/entities";
import { HomeCardHeader } from "./HomeCardHeader";

type FutureBlock = TimeBlockWithProject & { date?: string };

export function FutureView({ tasks, blocks }: {
  tasks: (Task & { project: Project | null })[];
  blocks: FutureBlock[];
}) {
  const days = [1, 2].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return { key: localDateKey(date), date, title: offset === 1 ? "Mañana" : "Pasado mañana" };
  });
  return (
    <section className="home-card home-future" aria-label="Próximos días">
      <HomeCardHeader icon={CalendarDays} title="Próximos días" subtitle="Tu siguiente ritmo" action={
        <Link aria-label="Ver agenda" className="home-icon-action" href="/timeblocks"><MoreHorizontal size={18} /></Link>
      } />
      {days.map((day) => {
        const dayTasks = tasks.filter((task) => task.dueDate && localDateKey(task.dueDate) === day.key).slice(0, 3);
        const dayBlocks = blocks.filter((block) => block.date ? localDateKey(block.date) === day.key : block.daysOfWeek.includes(day.date.getDay())).sort((a, b) => a.startMin - b.startMin);
        return (
          <div className="home-future-day" key={day.key}>
            <time dateTime={day.key} className="home-future-date" title={day.title}>
              <span>{new Intl.DateTimeFormat("es-DO", { weekday: "short" }).format(day.date).replace(".", "").toUpperCase()}</span>
              <strong>{day.date.getDate()}</strong>
            </time>
            <div className="min-w-0 flex-1 space-y-2 font-body-sm text-body-sm text-on-surface-variant">
              {dayBlocks.length === 0 ? <p>• &nbsp;Sin bloques</p> : dayBlocks.map((block) => (
                <Link className="block hover:text-primary" href="/timeblocks" key={block.id}>
                  <span className="block truncate">{block.name ?? block.project?.name ?? "Bloque de enfoque"}</span>
                  <span className="text-xs">{minToTime(block.startMin)}–{minToTime(block.endMin)}</span>
                </Link>
              ))}
              {dayTasks.length === 0 ? <p>• &nbsp;Sin tareas</p> : dayTasks.map((task) => (
                <Link className="block truncate hover:text-primary" href={`/tasks?taskId=${encodeURIComponent(task.id)}`} key={task.id}>• &nbsp;{task.title}</Link>
              ))}
            </div>
            <Link aria-label={`Ver agenda: ${day.title}`} className="home-icon-action" href="/timeblocks"><ChevronRight size={18} /></Link>
          </div>
        );
      })}
    </section>
  );
}
