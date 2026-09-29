"use client";

import "@/components/ui/official.css";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { PomodoroSettings } from "@/types/entities";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePomodoroMutations } from "../hooks/usePomodoro";

export function SettingsModal({ settings, onClose }: { settings: PomodoroSettings; onClose: () => void }) {
  const mutations = usePomodoroMutations();
  const [form, setForm] = useState({
    workSec: Math.round(settings.workSec / 60),
    shortBreakSec: Math.round(settings.shortBreakSec / 60),
    longBreakSec: Math.round(settings.longBreakSec / 60),
    cyclesPerLong: settings.cyclesPerLong,
    autoCycle: settings.autoCycle,
    soundEnabled: settings.soundEnabled,
  });

  const save = async () => {
    try {
      await mutations.updateSettings.mutateAsync({
        workSec: form.workSec * 60,
        shortBreakSec: form.shortBreakSec * 60,
        longBreakSec: form.longBreakSec * 60,
        cyclesPerLong: form.cyclesPerLong,
        autoCycle: form.autoCycle,
        soundEnabled: form.soundEnabled,
      });
      toast.success("¡Listo! Guardamos tu configuración");
      onClose();
    } catch {
      toast.error("Ups, no pudimos guardar la configuración. Inténtalo de nuevo.");
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="official-dialog flex flex-col" overlayClassName="bg-[#0f1f33]/24 supports-backdrop-filter:backdrop-blur-none" showCloseButton={false}>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant bg-surface-bright px-5 py-4 text-left">
          <div>
            <DialogTitle className="font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">Tu ritmo de enfoque</DialogTitle>
            <DialogDescription className="mt-2">Ajusta los tiempos para que funcionen para ti.</DialogDescription>
          </div>
          <DialogClose asChild>
             <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button">
              <X size={19} />
            </button>
          </DialogClose>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto" data-modal-scroll>
          <div className="official-form-grid py-2">
            {([['workSec', 'Trabajo'], ['shortBreakSec', 'Descanso corto'], ['longBreakSec', 'Descanso largo']] as const).map(([key, label]) => (
              <label className="block" key={key}>
                <span className="font-label-caps text-label-caps text-on-surface-variant">{label} (MIN)</span>
                <input className="field mt-1" min={1} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) || 1 })} type="number" value={form[key]} />
              </label>
            ))}
            <label className="block">
              <span className="font-label-caps text-label-caps text-on-surface-variant">CICLOS</span>
              <input className="field mt-1" min={1} onChange={(event) => setForm({ ...form, cyclesPerLong: Number(event.target.value) || 1 })} type="number" value={form.cyclesPerLong} />
            </label>
          </div>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-body-sm text-body-sm">Cambiar de fase automáticamente</span>
              <button
                aria-label="Cambiar de fase automáticamente"
                aria-pressed={form.autoCycle}
                className="official-toggle-value"
                onClick={() => setForm({ ...form, autoCycle: !form.autoCycle })}
                type="button"
              >
                {form.autoCycle ? "Sí" : "No"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-body-sm text-body-sm">Reproducir sonido al terminar</span>
              <button
                aria-label="Reproducir sonido al terminar"
                aria-pressed={form.soundEnabled}
                className="official-toggle-value"
                onClick={() => setForm({ ...form, soundEnabled: !form.soundEnabled })}
                type="button"
              >
                {form.soundEnabled ? "Sí" : "No"}
              </button>
            </div>
          </div>
        </div>
        <div className="official-form-footer">
          <DialogClose asChild>
            <button className="min-h-11 rounded-md border border-outline-variant px-4 py-2 font-body-sm text-body-sm" type="button">Cancelar</button>
          </DialogClose>
           <button className="rounded-md bg-primary-container px-4 py-2 font-body-sm text-body-sm text-on-primary" onClick={() => void save()} type="button">Guardar ajustes</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
