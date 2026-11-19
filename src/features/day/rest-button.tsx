"use client";

import { useTransition } from "react";
import { useQuick } from "@/features/actions/context";
import { planAction } from "@/features/inbox/actions";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";
import { moveRows, restNews, type RestItem } from "./rest-of-day";

/**
 * One quiet button under what is left over: plan every task still open today for tomorrow. It says how many
 * moved, and its note carries an Undo that puts them back on today (the quick actions' note, as with any bulk change).
 */
export function RestOfDay({
  items,
  onStatus,
  plan = planAction,
}: {
  items: RestItem[];
  /** Where the note goes on a page drawn without the quick actions. */
  onStatus: (text: string, error: boolean) => void;
  /** Defaults to the server action; the dev harness passes an in-memory one. */
  plan?: (id: string, when: string) => Promise<ActionResult>;
}) {
  const quick = useQuick();
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;

  const move = (rows: RestItem[], when: "today" | "tomorrow") => moveRows(plan, rows, when);

  function run() {
    if (!quick) {
      startTransition(async () => {
        const said = await reach(move(items, "tomorrow"));
        const moved = Array.isArray(said) ? said : [];
        onStatus(restNews(moved.length, items.length - moved.length), moved.length === 0);
      });
      return;
    }
    quick.batch(
      items.map((r) => [r.id, { hidden: true }]),
      async () => {
        const moved = await move(items, "tomorrow");
        return {
          news: restNews(moved.length, items.length - moved.length),
          undo: moved.length
            ? () =>
                quick.batch([], async () => {
                  const back = await move(moved, "today");
                  return { news: back.length === moved.length ? "Back on today." : "Some of those did not move back. Try again." };
                })
            : undefined,
        };
      },
    );
  }

  return (
    <div className="mt-2">
      <button type="button" disabled={pending} onClick={run} className="pill h-8 px-2.5 text-[13px]">
        Plan the rest of today for tomorrow
      </button>
    </div>
  );
}
