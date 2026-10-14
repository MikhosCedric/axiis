import Link from "next/link";
import type { TagSummary } from "@/domain/tag";
import { openCount, tagHref } from "./model";

/** Every tag by name with how many open items carry it. Each opens its own page. */
export function TagIndexView({ tags, hrefFor = tagHref }: { tags: TagSummary[]; hrefFor?: (name: string) => string }) {
  return (
    <div className="max-w-[760px] px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      <h1 className="headline">Tags</h1>
      <p className="mt-2.5 text-[15px] text-ink-2">
        {tags.length === 0
          ? "No tags yet. Add one from any item's details."
          : `${tags.length === 1 ? "One tag" : `${tags.length} tags`}. Open one to see everything that carries it.`}
      </p>
      {tags.length > 0 && (
        <ul className="mt-6 border-t border-rule">
          {tags.map((t) => (
            <li key={t.id} className="border-b border-rule-soft">
              <Link
                href={hrefFor(t.name)}
                className="flex items-baseline justify-between gap-4 rounded-md px-2 py-2.5 hover:bg-hover pointer-coarse:min-h-11 pointer-coarse:items-center active:bg-press"
              >
                <span className="min-w-0 font-medium break-words text-ink">
                  <span aria-hidden="true" className="text-ink-3">
                    #
                  </span>
                  {t.name}
                </span>
                <span className="flex-none text-[13px] text-ink-3 tabular">{openCount(t.open)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
