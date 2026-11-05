"use client";

import { useTransition } from "react";
import { planAction } from "@/features/inbox/actions";
import type { ActionResult } from "@/features/today/commands";
import { Glyph } from "@/features/today/glyph";
import { moveLeftoverAction } from "./leftover-actions";
import { leftoverHeading, shortPlanned, type LeftoverData } from "./leftover-model";
import { reach } from "@/lib/reach";
import { BEHIND_LIMIT } from "@/lib/items/repo";

const pill =
  "pill h-8";

/**
 * What was planned for an earlier day and is still open, with a way to bring it to today. Quiet on
 * purpose: no count in red, no days late. Each row opens the detail panel, like any item.
 */
export function LeftoverStrip({
  data,
  onSelect,
  onStatus,
  moveOne = (id) => planAction(id, "today"),
  moveAll = moveLeftoverAction,
}: {
  data: LeftoverData;
  onSelect: (id: string) => void;
  /** How a move went, for the screen's status line, which outlives this strip when the last row leaves. */
  onStatus: (text: string, error: boolean) => void;
  /** Default to the server actions; the dev harness passes in-memory ones. */
  moveOne?: (id: string) => Promise<ActionResult>;
  moveAll?: () => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();

  function run(work: () => Promise<ActionResult>, said: string) {
    startTransition(async () => {
      const result = await reach(work());
      if (result.ok) onStatus(said, false);
      else onStatus(result.error, true);
    });
  }

  return (
    <section aria-labelledby="leftover-h" className="surface mb-6 max-w-[720px] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="leftover-h" className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
          {/* The full sentence is what a screen reader hears; the eye gets two words and a count. */}
          <span className="sr-only">{leftoverHeading(data.total)}</span>
          <span aria-hidden="true">Left over</span>
          <span aria-hidden="true" className="rounded-full bg-hover px-1.5 text-xs leading-5 tabular text-ink-2">
            {data.total >= BEHIND_LIMIT ? `${BEHIND_LIMIT}+` : data.total}
          </span>
        </h2>
        {/* Moving all would move what the filter hides too, so a filtered strip moves one at a time. */}
        {!data.filtered && data.total > 1 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(moveAll, "Moved to today.")}
            title="Move all to today"
            className={`${pill} gap-1.5 pr-2.5 pl-2`}
          >
            <ArrowIcon />
            <span aria-hidden="true">All</span>
            <span className="sr-only">Move all to today</span>
          </button>
        )}
      </div>
      <ul className="mt-1">
        {data.rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 border-t border-rule-soft py-2 first:border-t-0">
            <span className="pt-[3px]">
              <Glyph type={row.type} state="planned" />
            </span>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onSelect(row.id)} className="block cursor-pointer rounded text-left font-medium break-words hover:underline">
                {row.title}
              </button>
              <span className="mt-0.5 block text-xs text-ink-3">
                <span className="sr-only">{row.planned}</span>
                <span aria-hidden="true">{shortPlanned(row.planned)}</span>
              </span>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => moveOne(row.id), `${row.title} is on today.`)}
              title="Move to today"
              className={`${pill} size-8 flex-none justify-center pointer-coarse:size-11`}
            >
              <ArrowIcon />
              <span className="sr-only">Move to today: {row.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {data.total > data.rows.length && <p className="mt-1 text-xs text-ink-3">And {data.total - data.rows.length} more.</p>}
    </section>
  );
}

/** An arrow into the day: send this one to today. */
function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8h9M8 4.5L11.5 8 8 11.5M13.5 3.5v9" />
    </svg>
  );
}
