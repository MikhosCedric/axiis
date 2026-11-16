"use client";

import Link from "next/link";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { Glyph } from "@/features/today/glyph";
import { DUE_PATH } from "@/features/due/model";
import type { DueSoonData } from "./due-soon";

/**
 * The next few due dates, in the Day's side column: open items due from today on, soonest first, each a way into
 * the detail panel. Quiet like its neighbours: a word for the date, no count of days, nothing about being late.
 */
export function DueSoonStrip({ data, onSelect }: { data: DueSoonData; onSelect: (id: string) => void }) {
  const keep = useKeepFilter();
  return (
    <section aria-labelledby="due-soon-h" className="surface side-part px-4 py-3">
      <h2 id="due-soon-h" className="text-[13px] font-semibold text-ink-2">
        Due soon
      </h2>
      <ul className="mt-1">
        {data.rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 border-t border-rule-soft py-2 first:border-t-0">
            <span className="pt-[3px]">
              <Glyph type={row.type} state="planned" />
            </span>
            <button type="button" onClick={() => onSelect(row.id)} className="tap-y min-w-0 flex-1 cursor-pointer rounded text-left font-medium break-words hover:underline">
              {row.title}
              <span className="sr-only">, {row.words}</span>
            </button>
            <span aria-hidden="true" className="flex-none pt-0.5 text-xs text-ink-3 tabular">
              {row.chip}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-3">
        {data.total > data.rows.length && <>And {data.total - data.rows.length} more. </>}
        <Link href={keep(DUE_PATH)} className="font-medium text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink">
          All due dates
        </Link>
      </p>
    </section>
  );
}
