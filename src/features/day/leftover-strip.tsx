"use client";

import { useTransition } from "react";
import { planAction } from "@/features/inbox/actions";
import type { ActionResult } from "@/features/today/commands";
import { Glyph } from "@/features/today/glyph";
import { moveLeftoverAction } from "./leftover-actions";
import { leftoverHeading, type LeftoverData } from "./leftover-model";

const button =
  "rounded-md px-2.5 py-1 font-medium text-ink-2 hover:bg-hover active:bg-press hover:text-ink pointer-coarse:min-h-11 disabled:opacity-50";

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
      const result = await work();
      if (result.ok) onStatus(said, false);
      else onStatus(result.error, true);
    });
  }

  return (
    <section aria-labelledby="leftover-h" className="mb-6 border-y border-rule py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 id="leftover-h" className="text-[13px] font-semibold text-ink-2">
          {leftoverHeading(data.total)}
        </h2>
        <button type="button" disabled={pending} onClick={() => run(moveAll, "Moved to today.")} className={`${button} -ml-2 sm:ml-auto`}>
          Move {data.total === 1 ? "it" : "all"} to today
        </button>
      </div>
      <ul className="mt-1">
        {data.rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 border-t border-rule-soft py-1.5 first:border-t-0">
            <Glyph type={row.type} state="planned" />
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onSelect(row.id)} className="cursor-pointer rounded text-left tap-y font-medium break-words hover:underline">
                {row.title}
              </button>
              <span className="ml-2 text-xs text-ink-3">{row.planned}</span>
            </div>
            <button type="button" disabled={pending} onClick={() => run(() => moveOne(row.id), `${row.title} is on today.`)} className={button}>
              Move to today<span className="sr-only">: {row.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {data.total > data.rows.length && <p className="mt-1 text-xs text-ink-3">And {data.total - data.rows.length} more.</p>}
    </section>
  );
}
