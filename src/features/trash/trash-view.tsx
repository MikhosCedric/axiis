"use client";

import { startTransition, useOptimistic, useState } from "react";
import { BackLink } from "@/components/back-link";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";

export type TrashRow = { id: string; title: string; kind: string; daysAgo: number };

const when = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/** Items deleted in the last 30 days, each with a Restore. After 30 days they are removed for good. */
export function TrashView({ rows, restore }: { rows: TrashRow[]; restore: (ids: string[]) => Promise<ActionResult> }) {
  const [shown, hide] = useOptimistic(rows, (current: TrashRow[], id: string) => current.filter((r) => r.id !== id));
  const [message, setMessage] = useState<string | null>(null);

  function bringBack(row: TrashRow) {
    setMessage(null);
    startTransition(async () => {
      hide(row.id);
      const result = await reach(restore([row.id]));
      setMessage(result.ok ? `${row.title} is back.` : result.error);
    });
  }

  return (
    <div className="mx-auto max-w-[880px] px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      <BackLink fallback="/settings" />
      <h1 className="mt-2 headline">Recently deleted</h1>
      <p className="page-summary">
        {shown.length === 0 ? "Nothing deleted lately." : "Deleted items stay here for 30 days, then they are removed for good."}
      </p>
      {shown.length > 0 && (
        <ul className="surface mt-6 overflow-hidden px-3 py-1.5 [&_li:last-child]:border-b-0">
          {shown.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 border-b border-rule-soft py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{row.title}</span>
                <span className="block text-[13px] text-ink-3">
                  {row.kind}, deleted {when(row.daysAgo)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => bringBack(row)}
                aria-label={`Restore ${row.title}`}
                className="flex-none rounded-md px-2.5 py-1.5 font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:min-h-11"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-2 min-h-5 text-[13px] text-ink-2">
        {message}
      </p>
    </div>
  );
}
