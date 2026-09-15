"use client";

import { Check, ChevronDown, UserRound } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskPriority, TaskStatus } from "@/types/entities";
import { cn, localDateKey } from "@/lib/utils";

export const taskStatusOptions: { value: TaskStatus; label: string }[] = [
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

export const taskPriorityOptions: { value: TaskPriority; label: string }[] = [
  { value: "URGENT", label: "Urgente" },
  { value: "HIGH", label: "Alta" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Baja" },
];

export const taskStatusStyles: Record<TaskStatus, string> = {
  PENDING: "border-outline-variant bg-surface-container-high text-on-surface-variant",
  IN_PROGRESS: "border-transparent bg-info-container text-on-info-container",
  COMPLETED: "border-tertiary/30 bg-tertiary-container text-on-tertiary-container",
  CANCELLED: "border-error/30 bg-error-container text-on-error-container",
};

export const taskPriorityLabels: Record<TaskPriority, string> = Object.fromEntries(
  taskPriorityOptions.map((option) => [option.value, option.label]),
) as Record<TaskPriority, string>;

export const taskPriorityStyles: Record<TaskPriority, string> = {
  URGENT: "border-error bg-error-container text-on-error-container",
  HIGH: "border-warning bg-warning-container text-on-warning-container",
  NORMAL: "border-outline-variant bg-secondary-container text-on-secondary-container",
  LOW: "border-outline bg-surface-container-high text-on-surface-variant",
};

export const taskBadgeClass =
  "inline-flex h-8 max-w-full cursor-pointer items-center rounded-full border px-2.5 py-1 font-label-md text-label-md font-semibold leading-4 outline-none transition-colors disabled:cursor-wait disabled:opacity-60";

export function TaskStatusSelect({
  value,
  onChange,
  disabled = false,
  className,
  ariaLabel = "Cambiar estado",
}: {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select onValueChange={(next) => onChange(next as TaskStatus)} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          taskBadgeClass,
          taskStatusStyles[value],
          "gap-1.5 pr-2 text-left",
          className,
        )}
        disabled={disabled}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {taskStatusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskPrioritySelect({
  value,
  onChange,
  disabled = false,
  className,
  ariaLabel = "Cambiar prioridad",
}: {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select onValueChange={(next) => onChange(next as TaskPriority)} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          taskBadgeClass,
          taskPriorityStyles[value],
          "gap-1.5 pr-2 text-left",
          className,
        )}
        disabled={disabled}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {taskPriorityOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type TaskAssigneeOption = {
  id: string;
  avatarUrl: string | null;
  email: string;
  label: string;
  name: string | null;
};

export function TaskAssigneeSelect({
  value,
  options,
  onChange,
  disabled = false,
  className,
  ariaLabel = "Cambiar responsable",
}: {
  value: string | null;
  options: TaskAssigneeOption[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value) ?? null;

  const select = (nextValue: string | null) => {
    setOpen(false);
    onChange(nextValue);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={ariaLabel}
          className={cn(
            "inline-flex min-h-8 min-w-0 max-w-[13rem] items-center gap-1.5 rounded-md border border-transparent px-1 py-1 text-left font-body-sm text-body-sm font-medium text-on-surface outline-none hover:bg-surface-container-low hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-wait disabled:opacity-60",
            className,
          )}
          disabled={disabled}
          type="button"
        >
          {selected ? (
            <Avatar
              avatarUrl={selected.avatarUrl}
              email={selected.email}
              name={selected.name}
              size="xs"
            />
          ) : (
            <UserRound
              aria-hidden="true"
              className="size-4 shrink-0 text-on-surface-variant"
            />
          )}
          <span className="min-w-0 truncate">
            {selected?.label ?? "Sin asignar"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-on-surface-variant"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar responsable..." />
          <CommandList>
            <CommandEmpty>
              {options.length > 0
                ? "No encontramos ese responsable."
                : "No hay miembros disponibles."}
            </CommandEmpty>
            <CommandGroup heading="Responsables">
              <CommandItem
                onSelect={() => select(null)}
                value="sin asignar"
              >
                <Check
                  className={cn(
                    "size-4",
                    value === null ? "opacity-100" : "opacity-0",
                  )}
                />
                <span>Sin asignar</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => select(option.id)}
                  value={`${option.label} ${option.email} ${option.id}`}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Avatar
                    avatarUrl={option.avatarUrl}
                    email={option.email}
                    name={option.name}
                    size="xs"
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function dateFromDatetimeLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function datetimeWithDate(value: string, date: Date) {
  const time = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? value.slice(11)
    : "09:00";
  return `${localDateKey(date)}T${time}`;
}

export function datetimeWithTime(value: string, time: string) {
  const date = value.slice(0, 10) || localDateKey(new Date());
  return `${date}T${time}`;
}

export function TaskDueDateEditor({
  dueDateDraft,
  fullWidth = false,
  onCancel,
  onDateChange,
  onRemove,
  onSave,
  onTimeChange,
  pending,
}: {
  dueDateDraft: string;
  fullWidth?: boolean;
  onCancel: () => void;
  onDateChange: (date: Date) => void;
  onRemove: () => void;
  onSave: () => void;
  onTimeChange: (time: string) => void;
  pending: boolean;
}) {
  return (
    <>
      <Calendar
        aria-label="Seleccionar fecha de vencimiento"
        className={fullWidth ? "w-full max-w-full" : "mx-auto"}
        classNames={
          fullWidth
            ? {
                day: "relative flex-1 p-0 text-center text-sm",
                day_button: "size-full min-h-9",
                weekday:
                  "h-8 flex-1 rounded-md text-center font-label-caps text-[10px] text-on-surface-variant",
                weekdays: "flex w-full",
              }
            : undefined
        }
        defaultMonth={dateFromDatetimeLocal(dueDateDraft) ?? new Date()}
        mode="single"
        onSelect={(date) => {
          if (date) onDateChange(date);
        }}
        selected={dateFromDatetimeLocal(dueDateDraft)}
      />
      <div className="border-t border-outline-variant p-3">
        <label className="flex items-center justify-between gap-3 font-label-caps text-label-caps text-on-surface-variant">
          Hora
          <input
            aria-label="Hora de vencimiento"
            className="h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 font-data-mono text-data-mono text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            onChange={(event) => onTimeChange(event.target.value)}
            type="time"
            value={dueDateDraft.slice(11, 16)}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            className="min-h-11 shrink-0 rounded-lg px-3 py-2 font-label-md text-label-md font-semibold text-error hover:bg-error-container disabled:cursor-wait disabled:opacity-50"
            disabled={pending}
            onClick={onRemove}
            type="button"
          >
            Quitar fecha
          </button>
          <span className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5">
            <button
              className="min-h-11 rounded-lg px-3 py-2 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              onClick={onCancel}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              disabled={pending || !dueDateDraft}
              onClick={onSave}
              type="button"
            >
              Guardar
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
