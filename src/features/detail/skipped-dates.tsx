"use client";

import { useId } from "react";
import type { SkippedDate } from "./model";

/** The dates a series was skipped on. A skipped one is not drawn on its day, so this is the way back to it. */
export function SkippedDates({ skipped, restore }: { skipped: SkippedDate[]; restore: (date: SkippedDate) => void }) {
  const headingId = useId();
  if (skipped.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="grid gap-2 border-t border-rule pt-4">
      <h3 id={headingId} className="font-serif text-lg font-medium">
        Skipped dates
      </h3>
      <ul className="grid">
        {skipped.map((date) => (
          <li key={date.key} className="flex items-center justify-between gap-3 border-b border-rule-soft py-1.5">
            <span className="text-ink-2">{date.on}</span>
            <button
              type="button"
              aria-label={`Restore ${date.on}`}
              onClick={() => restore(date)}
              className="rounded-md px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-accent-wash hover:text-ink"
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
