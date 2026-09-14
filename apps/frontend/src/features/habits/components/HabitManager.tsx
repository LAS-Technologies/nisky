"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHabitsQuery, useHabitMutations } from "../hooks/useHabits";
import type { Habit, HabitFrequency } from "@/types/entities";
import { cn } from "@/lib/utils";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };
const DAY_NAMES: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };

function habitPattern(habit: Habit): string {
  if (habit.daysOfWeek.length === 7) return "Diario";
  if (habit.daysOfWeek.length === 0) return habit.frequency === "WEEKLY" ? "Semanal" : "Diario";
  return habit.daysOfWeek
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
    .map((day) => DAY_LABELS[day])
    .join(" · ");
}

function DaysPicker({ value, onChange, disabled }: { value: number[]; onChange: (days: number[]) => void; disabled?: boolean }) {
  const toggle = (day: number) => {
    if (value.includes(day)) {
      if (value.length === 1) return;
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAY_ORDER.map((day) => (
        <button
          aria-label={DAY_NAMES[day]}
          aria-pressed={value.includes(day)}
          className={cn(
             "flex h-8 w-9 items-center justify-center rounded-md border font-label-caps text-label-caps",
            value.includes(day) ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
          )}
          disabled={disabled}
          key={day}
          onClick={() => toggle(day)}
          type="button"
        >
          {DAY_LABELS[day]}
        </button>
      ))}
    </div>
  );
}

export function HabitManager({ onClose }: { onClose: () => void }) {
  const query = useHabitsQuery({ includeArchived: true });
  const mutations = useHabitMutations();
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState<HabitFrequency>("DAILY");
  const [newDays, setNewDays] = useState<number[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [editFrequency, setEditFrequency] = useState<Record<string, HabitFrequency>>({});
  const [editDays, setEditDays] = useState<Record<string, number[]>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    if (newFrequency === "WEEKLY" && newDays.length === 0) {
      toast.error("Elige al menos un día para el hábito.");
      return;
    }
    try {
      await mutations.create.mutateAsync({
        name,
        frequency: newFrequency,
        ...(newFrequency === "WEEKLY"
          ? { daysOfWeek: newDays }
          : { daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
      });
      setNewName("");
      setNewFrequency("DAILY");
      setNewDays([]);
      toast.success("Hábito añadido");
    } catch {
      toast.error("Ups, no pudimos crear el hábito. Inténtalo de nuevo.");
    }
  };

  const rename = async (id: string) => {
    const name = names[id]?.trim();
    const original = query.data?.find((habit) => habit.id === id)?.name;
    if (!name || name === original) return;
    try {
      await mutations.update.mutateAsync({ id, payload: { name } });
    } catch {
      toast.error("Ups, no pudimos actualizar el hábito. Inténtalo de nuevo.");
    }
  };

  const savePattern = async (habit: Habit) => {
    const frequency = editFrequency[habit.id] ?? habit.frequency;
    const days = editDays[habit.id] ?? habit.daysOfWeek;
    const normalizedDays = frequency === "WEEKLY" ? days : [0, 1, 2, 3, 4, 5, 6];
    if (frequency === "WEEKLY" && normalizedDays.length === 0) {
      toast.error("Elige al menos un día para el hábito.");
      return;
    }
    const changed =
      frequency !== habit.frequency ||
      normalizedDays.length !== habit.daysOfWeek.length ||
      normalizedDays.some((d, i) => d !== habit.daysOfWeek[i]);
    if (!changed) {
      setOpenId(null);
      return;
    }
    try {
      await mutations.update.mutateAsync({
        id: habit.id,
        payload: {
          frequency,
          daysOfWeek: normalizedDays,
          targetDays: normalizedDays.length,
        },
      });
      setOpenId(null);
      toast.success("Hábito actualizado");
    } catch {
      toast.error("Ups, no pudimos actualizar el hábito. Inténtalo de nuevo.");
    }
  };

  const archive = async (id: string) => {
    try {
      await mutations.update.mutateAsync({ id, payload: { archived: true } });
      toast.success("Hábito archivado");
    } catch {
      toast.error("Ups, no pudimos archivar el hábito. Inténtalo de nuevo.");
    }
  };

  const restore = async (id: string) => {
    try {
      await mutations.update.mutateAsync({ id, payload: { archived: false } });
      toast.success("Hábito restaurado");
    } catch {
      toast.error("Ups, no pudimos restaurar el hábito. Inténtalo de nuevo.");
    }
  };

  const remove = async (id: string) => {
    if (deleteId !== id) {
      setDeleteId(id);
      return;
    }
    try {
      await mutations.remove.mutateAsync(id);
      setDeleteId(null);
      toast.success("Hábito eliminado");
    } catch {
      toast.error("Ups, no pudimos eliminar el hábito. Inténtalo de nuevo.");
    }
  };

  const toggleExpand = (habit: Habit) => {
    if (openId === habit.id) {
      setOpenId(null);
      return;
    }
    setOpenId(habit.id);
    setEditFrequency((current) => ({ ...current, [habit.id]: habit.frequency }));
    setEditDays((current) => ({ ...current, [habit.id]: habit.frequency === "WEEKLY" ? habit.daysOfWeek : [] }));
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden rounded-lg border-outline-variant bg-surface p-0" keyboardAware showCloseButton={false}>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant bg-surface-bright px-5 py-4 text-left">
          <div>
            <DialogTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">Gestionar hábitos</DialogTitle>
            <DialogDescription className="sr-only">Crea, edita, archiva o elimina tus hábitos.</DialogDescription>
          </div>
          <DialogClose asChild>
             <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button"><X size={19} /></button>
          </DialogClose>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" data-modal-scroll>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input className="field" onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} placeholder="Nuevo hábito..." value={newName} />
               <button className="rounded-md border border-outline-variant px-3 font-body-sm text-body-sm hover:bg-surface-container-high" onClick={() => void create()} type="button">Añadir</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Frecuencia"
                className="field w-auto"
                onChange={(event) => setNewFrequency(event.target.value as HabitFrequency)}
                value={newFrequency}
              >
                <option value="DAILY">Todos los días</option>
                <option value="WEEKLY">Algunos días a la semana</option>
              </select>
              {newFrequency === "WEEKLY" && <DaysPicker onChange={setNewDays} value={newDays} />}
            </div>
          </div>
          {query.isLoading ? <p className="font-body-sm text-body-sm text-on-surface-variant">Cargando hábitos...</p> : (query.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary-fixed/30 px-4 py-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Sparkles aria-hidden="true" size={18} />
              </span>
              <div>
                <p className="font-body-sm text-body-sm font-semibold text-on-surface">Tu primer hábito empieza aquí</p>
                <p className="mt-1 max-w-sm font-body-sm text-body-sm text-on-surface-variant">
                  Elige algo sencillo que quieras repetir y conviértelo en parte de tu ritmo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-outline-variant border-y border-outline-variant">
              {(query.data ?? []).filter((habit) => !habit.archived).map((habit) => (
                <div key={habit.id}>
                  <div className="flex items-center gap-2 py-2">
                    <input className="field h-8" onBlur={() => void rename(habit.id)} onChange={(event) => setNames((current) => ({ ...current, [habit.id]: event.target.value }))} value={names[habit.id] ?? habit.name} />
                    <span className="hidden shrink-0 font-data-mono text-data-mono text-xs text-on-surface-variant sm:inline">{habitPattern(habit)}</span>
                     <button aria-label={`Configurar ${habit.name}`} className="shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => toggleExpand(habit)} type="button">{openId === habit.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                     <button aria-label={`Archivar ${habit.name}`} className="shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary" onClick={() => void archive(habit.id)} type="button"><Archive size={16} /></button>
                     <button aria-label={`Eliminar ${habit.name}`} className={`shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-error-container hover:text-error ${deleteId === habit.id ? "bg-error text-error-foreground" : ""}`} onClick={() => void remove(habit.id)} type="button"><Trash2 className={deleteId === habit.id ? "text-on-primary" : undefined} size={16} /></button>
                  </div>
                  {openId === habit.id && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant py-3 pl-1">
                      <select
                        aria-label="Frecuencia"
                        className="field w-auto"
                        onChange={(event) => setEditFrequency((current) => ({ ...current, [habit.id]: event.target.value as HabitFrequency }))}
                        value={editFrequency[habit.id] ?? habit.frequency}
                      >
                        <option value="DAILY">Todos los días</option>
                        <option value="WEEKLY">Algunos días a la semana</option>
                      </select>
                      {(editFrequency[habit.id] ?? habit.frequency) === "WEEKLY" && (
                        <DaysPicker
                          onChange={(days) => setEditDays((current) => ({ ...current, [habit.id]: days }))}
                          value={editDays[habit.id] ?? habit.daysOfWeek}
                        />
                      )}
                       <button className="rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm text-primary hover:bg-surface-container-high" onClick={() => void savePattern(habit)} type="button">Guardar</button>
                    </div>
                  )}
                </div>
              ))}
              {(query.data ?? []).filter((habit) => !habit.archived).length === 0 && <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">No hay hábitos activos.</p>}
              </div>
              {(query.data ?? []).some((habit) => habit.archived) && <section className="border-t border-outline-variant pt-3">
                <h3 className="mb-2 font-label-caps text-label-caps text-on-surface-variant">ARCHIVADOS</h3>
                <div className="divide-y divide-outline-variant border-y border-outline-variant">
                  {(query.data ?? []).filter((habit) => habit.archived).map((habit) => (
                    <div className="flex items-center gap-2 py-2" key={habit.id}>
                      <span className="flex-1 font-body-sm text-body-sm text-on-surface-variant">{habit.name} <span className="font-data-mono text-data-mono text-xs">· {habitPattern(habit)}</span></span>
                       <button aria-label={`Desarchivar ${habit.name}`} className="flex items-center gap-1 rounded-md px-2 py-1 font-body-sm text-body-sm text-primary hover:bg-surface-container-low hover:underline" onClick={() => void restore(habit.id)} type="button"><ArchiveRestore size={16} /> Desarchivar</button>
                       <button aria-label={`Eliminar ${habit.name}`} className={`shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-error-container hover:text-error ${deleteId === habit.id ? "bg-error text-error-foreground" : ""}`} onClick={() => void remove(habit.id)} type="button"><Trash2 className={deleteId === habit.id ? "text-on-primary" : undefined} size={16} /></button>
                    </div>
                  ))}
                </div>
              </section>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-outline-variant bg-surface-container-low px-5 py-4">
          <DialogClose asChild>
            <button className="min-h-11 rounded-md border border-outline-variant px-4 py-2 font-body-sm text-body-sm hover:bg-surface-container-high" type="button">Cerrar</button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
