"use client";

import type { ItemType } from "@/domain/item";
import { Glyph } from "@/features/today/glyph";

/** The beam glyph as the done checkbox, as on the Today list. */
export function GlyphCheckbox({
  type,
  done,
  justDone,
  label,
  onChange,
  disabled = false,
}: {
  type: ItemType;
  done: boolean;
  justDone: boolean;
  label: string;
  onChange: (done: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`relative grid h-8 w-12 flex-none place-items-center rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        disabled ? "opacity-50" : "cursor-pointer hover:bg-hover active:bg-press"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={done}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <Glyph type={type} state={done ? "done" : "planned"} justDone={justDone && done} />
    </label>
  );
}
