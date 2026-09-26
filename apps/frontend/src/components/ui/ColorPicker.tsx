"use client";

export const PROJECT_COLORS = [
  "#0f172a",
  "#006d77",
  "#8b5e3c",
  "#6b4f4f",
  "#2d5a27",
  "#5c1a1a",
  "#1a3a5c",
  "#4a4a2a",
];

export function ColorPicker({ value, onChange, name, disabled = false, colors = PROJECT_COLORS }: { value: string; onChange: (color: string) => void; name?: string; disabled?: boolean; colors?: string[] }) {
  return (
    <div aria-label="Colores disponibles" className="flex flex-wrap gap-2" role="radiogroup">
      {colors.map((color) => {
        const selected = color === value;
        return (
          <button
            aria-checked={selected}
            aria-label={`Color ${color}`}
            className={`h-8 w-8 rounded-full border-2 transition-transform disabled:cursor-wait disabled:opacity-50 ${selected ? "scale-110 border-on-surface" : "border-outline-variant hover:scale-105"}`}
            disabled={disabled}
            key={color}
            name={name}
            onClick={() => onChange(color)}
            role="radio"
            style={{ backgroundColor: color }}
            type="button"
          />
        );
      })}
    </div>
  );
}
