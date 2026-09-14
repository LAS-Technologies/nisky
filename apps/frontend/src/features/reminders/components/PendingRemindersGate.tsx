"use client";

import { AlarmClock, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Reminder } from "@/types/entities";
import { usePendingRemindersQuery, useReminderMutations } from "../hooks/useReminders";

const OPEN_PENDING_EVENT = "nisky:open-pending-reminders";

const SNOOZE_PRESETS: { label: string; minutes: number }[] = [
  { label: "10 min", minutes: 10 },
  { label: "1 hora", minutes: 60 },
];

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function formatDue(value: string) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function PendingRemindersGate() {
  const query = usePendingRemindersQuery();
  const mutations = useReminderMutations();
  const [dismissed, setDismissed] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const remaining = (query.data ?? []).filter((reminder) => !resolvedIds.includes(reminder.id));
  const current = remaining[0];

  useEffect(() => {
    const open = () => {
      setDismissed(false);
      void query.refetch();
    };
    window.addEventListener(OPEN_PENDING_EVENT, open);
    return () => window.removeEventListener(OPEN_PENDING_EVENT, open);
  }, [query]);

  const settle = async (id: string, action: (reminder: Reminder) => { id: string; payload: { action: "accept" } | { action: "snooze"; triggerAt: string } }) => {
    if (busy) return;
    setBusy(true);
    try {
      const reminder = remaining.find((item) => item.id === id);
      if (!reminder) return;
      await mutations.resolve.mutateAsync(action(reminder));
      setResolvedIds((ids) => [...ids, id]);
      setCustomDate("");
    } catch {
      toast.error("Ups, no pudimos actualizar el recordatorio. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  if (!current || dismissed) return null;

  return (
    <PendingReminderModal
      busy={busy}
      customDate={customDate}
      onCustomDateChange={setCustomDate}
      onDismiss={() => setDismissed(true)}
      onSettle={settle}
      reminder={current}
      total={remaining.length}
    />
  );
}

function PendingReminderModal({ reminder, total, busy, customDate, onCustomDateChange, onDismiss, onSettle }: {
  reminder: Reminder;
  total: number;
  busy: boolean;
  customDate: string;
  onCustomDateChange: (value: string) => void;
  onDismiss: () => void;
  onSettle: (id: string, action: (reminder: Reminder) => { id: string; payload: { action: "accept" } | { action: "snooze"; triggerAt: string } }) => void;
}) {
  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onDismiss(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col gap-0 overflow-hidden rounded-lg border-outline-variant bg-surface p-0" keyboardAware showCloseButton={false}>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-outline-variant bg-surface-bright px-5 py-4 text-left">
          <div>
            <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">RECORDATORIOS PENDIENTES · {total} {total === 1 ? "AVISO" : "AVISOS"}</p>
            <DialogTitle className="mt-1 font-headline-xs text-headline-xs font-bold normal-case tracking-normal text-primary">Recordatorio vencido</DialogTitle>
            <DialogDescription className="sr-only">Revisa y pospone o completa el recordatorio vencido.</DialogDescription>
          </div>
          <DialogClose asChild>
            <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button"><X size={19} /></button>
          </DialogClose>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5" data-modal-scroll>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-primary"><AlarmClock size={18} /></span>
            <div className="min-w-0">
              <p className="font-headline-sm text-headline-sm font-bold text-on-surface">{reminder.title}</p>
              {reminder.body ? <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">{reminder.body}</p> : null}
              <p className="mt-2 font-data-mono text-data-mono text-xs capitalize text-on-surface-variant">Venció {formatDue(reminder.triggerAt)}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-outline-variant pt-4">
            <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">POSPONER</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SNOOZE_PRESETS.map((preset) => (
                <button
                  className="rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm hover:bg-surface-container-low hover:text-primary disabled:opacity-50"
                  disabled={busy}
                  key={preset.label}
                  onClick={() => void onSettle(reminder.id, (item) => ({ id: item.id, payload: { action: "snooze", triggerAt: new Date(Date.now() + preset.minutes * 60_000).toISOString() } }))}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
              <button
                className="rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm hover:bg-surface-container-low hover:text-primary disabled:opacity-50"
                disabled={busy}
                onClick={() => void onSettle(reminder.id, (item) => ({ id: item.id, payload: { action: "snooze", triggerAt: tomorrowAtNine().toISOString() } }))}
                type="button"
              >
                Mañana 9:00
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
               <input aria-label="Fecha personalizada" className="field min-w-0 flex-1" onChange={(event) => onCustomDateChange(event.target.value)} type="datetime-local" value={customDate} />
              <button
                 className="rounded-md border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm hover:bg-surface-container-low hover:text-primary disabled:opacity-50"
                disabled={busy || !customDate}
                onClick={() => {
                  const triggerAt = new Date(customDate).toISOString();
                  void onSettle(reminder.id, (item) => ({ id: item.id, payload: { action: "snooze", triggerAt } }));
                }}
                type="button"
              >
                Posponer
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-outline-variant bg-surface-container-low px-5 py-4">
          <DialogClose asChild>
            <button className="rounded-md px-2 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface disabled:opacity-50" disabled={busy} type="button">Ahora no</button>
          </DialogClose>
          <button
             className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-50"
            disabled={busy}
            onClick={() => void onSettle(reminder.id, (item) => ({ id: item.id, payload: { action: "accept" } }))}
            type="button"
          >
            <Check size={15} /> Hecho
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
