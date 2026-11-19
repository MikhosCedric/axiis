"use client";

import { useState, useTransition } from "react";
import { useItemSelection } from "@/features/detail/use-item-selection";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";
import { moveLeftoverAction } from "./leftover-actions";
import { LeftoverStrip } from "./leftover-strip";
import type { LeftoverData } from "./leftover-model";
import { BEHIND_LIMIT } from "@/lib/items/repo";

/**
 * Open items from earlier days, as one quiet line above Week and Month: how many, a way to see them, and
 * one way to bring them to today. The same rows and actions as Today's strip. It stays mounted after the
 * last one leaves so the status line can say where it went.
 */
export function LeftoverBar({
  data,
  moveAll = moveLeftoverAction,
}: {
  data: LeftoverData | null;
  /** Default to the server action; a harness passes an in-memory one. */
  moveAll?: () => Promise<ActionResult>;
}) {
  const { select } = useItemSelection();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!data) {
    return status ? (
      <p role="status" className="mb-3 text-[13px] text-ink-2">
        {status.text}
      </p>
    ) : null;
  }
  const count = data.total >= BEHIND_LIMIT ? `${BEHIND_LIMIT}+` : String(data.total);

  return (
    <section aria-label="Left over from earlier days" className="mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
        <p>
          <span className="tabular">{count}</span> left over from earlier days
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="leftover-bar-list"
          onClick={() => setOpen((v) => !v)}
          className="pill h-8 px-2.5"
        >
          {open ? "Hide" : "Show"}
        </button>
        {/* Moving all would move what the filter hides too, so a filtered line moves one at a time. */}
        {!data.filtered && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await reach(moveAll());
                setStatus(result.ok ? { text: "Moved to today.", error: false } : { text: result.error, error: true });
              })
            }
            className="pill h-8 px-2.5"
          >
            Move to today
          </button>
        )}
        <p role="status" className={status?.error ? "font-medium text-ink" : ""}>
          {status?.text}
        </p>
      </div>
      {open && (
        <div id="leftover-bar-list">
          <LeftoverStrip bare data={data} onSelect={select} onStatus={(text, error) => setStatus({ text, error })} />
        </div>
      )}
    </section>
  );
}
