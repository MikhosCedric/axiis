"use client";

import { useTransition } from "react";
import { planAction } from "@/features/inbox/actions";
import type { ActionResult } from "@/features/today/commands";
import { Glyph } from "@/features/today/glyph";
import type { ItemType } from "@/domain/item";
import { reach } from "@/lib/reach";

export type PlanDayRow = { id: string; type: ItemType; title: string };

/** How many Inbox items the strip offers; the rest are one tap away in the Inbox. */
export const PLAN_DAY_SHOWN = 3;

const button =
  "pill px-3 py-1";

/**
 * A morning nudge for a day with nothing on it while the Inbox has something waiting: the first few
 * Inbox items, each a tap from today. It goes as soon as the day has anything planned, and never
 * shows on a day with an empty Inbox. Quiet on purpose, one card, no count in red.
 */
export function PlanDayStrip({
  rows,
  total,
  onSelect,
  onStatus,
  planOne = (id) => planAction(id, "today"),
}: {
  rows: PlanDayRow[];
  /** Everything waiting in the Inbox, of which `rows` are the first few. */
  total: number;
  onSelect: (id: string) => void;
  onStatus: (text: string, error: boolean) => void;
  planOne?: (id: string) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();

  function plan(row: PlanDayRow) {
    startTransition(async () => {
      const result = await reach(planOne(row.id));
      if (result.ok) onStatus(`${row.title} is on today.`, false);
      else onStatus(result.error, true);
    });
  }

  return (
    <section aria-labelledby="plan-day-h" className="surface mb-5 max-w-[720px] px-4 py-3.5">
      <h2 id="plan-day-h" className="font-display text-lg leading-tight font-medium">
        Plan your day
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-3">Pull something in from the Inbox.</p>
      <ul className="mt-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 border-t border-rule-soft py-1.5 first:border-t-0">
            <Glyph type={row.type} state="planned" />
            <button type="button" onClick={() => onSelect(row.id)} className="min-w-0 flex-1 cursor-pointer rounded text-left tap-y font-medium break-words hover:underline">
              {row.title}
            </button>
            <button type="button" disabled={pending} onClick={() => plan(row)} className={button}>
              Plan for today<span className="sr-only">: {row.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {total > rows.length && <p className="mt-1 text-xs text-ink-3">And {total - rows.length} more in the Inbox.</p>}
    </section>
  );
}
