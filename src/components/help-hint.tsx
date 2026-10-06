"use client";

import { useState, type ReactNode } from "react";

/**
 * A small "?" that opens a help note on hover, on focus and on tap. The note
 * is always in the page, only hidden while closed, so `aria-describedby` can
 * still point at `id` and read it out.
 */
export function HelpHint({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="group relative mt-3 inline-block"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        setOpen(false);
        // Focus keeps the note open through :focus-within, so Escape lets go of it too.
        if (e.target instanceof HTMLElement) e.target.blur();
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="inline-grid size-6 place-items-center rounded-full border border-rule font-sans text-xs font-semibold text-ink-3 hover:bg-accent-wash hover:text-ink pointer-coarse:size-11"
      >
        ?
      </button>
      {/* The padding, not a margin, bridges the gap, so the pointer can travel into the note. */}
      <div
        id={id}
        data-open={open || undefined}
        className="invisible absolute bottom-full left-0 z-20 w-[min(72ch,calc(100vw-2rem))] pb-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 data-open:visible data-open:opacity-100 motion-reduce:transition-none"
      >
        <p className="rounded-lg border border-rule bg-sheet p-3 text-[13px] leading-relaxed text-ink-2 shadow-md">
          {children}
        </p>
      </div>
    </div>
  );
}
