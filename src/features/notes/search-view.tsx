import Link from "next/link";
import { QUERY_MAX } from "./commands";
import { SearchIcon } from "./icons";
import { TYPE_WORD, type SearchRow } from "./model";

/** Results across every item type. A plain GET form, so it works before any script loads. */
export function SearchView({ query, rows, basePath = "/search" }: { query: string; rows: SearchRow[]; basePath?: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pt-6 pb-16 rail:px-9 rail:pt-8">
      <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]">Search</h1>
      <form role="search" action={basePath} className="mt-6 flex gap-2">
        <label htmlFor="search-q" className="sr-only">
          Search everything
        </label>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">
            <SearchIcon />
          </span>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={query}
            autoFocus={!query}
            maxLength={QUERY_MAX}
            autoComplete="off"
            placeholder="Tasks, notes, checklists"
            className="w-full rounded-lg border border-field bg-sheet py-2.5 pr-3 pl-9 text-ink"
          />
        </div>
        <button type="submit" className="rounded-lg bg-ink px-4 font-medium text-paper hover:opacity-90">
          Search
        </button>
      </form>

      {!query ? (
        <p className="mt-6 max-w-[52ch] text-ink-2">
          Search finds words in titles and inside notes. Put a phrase in quotes, or a minus before a word to leave it out.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 max-w-[52ch] text-ink-2">Nothing matches “{query}”. Try fewer words.</p>
      ) : (
        <>
          <p className="mt-6 text-[13px] text-ink-3">
            {rows.length === 1 ? "One result" : `${rows.length} results`}, most recently edited first
          </p>
          <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] border-t border-rule">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-rule-soft">
                <Link href={r.href} className="block rounded-md px-2 py-3 hover:bg-accent-wash">
                  <span className={`block truncate font-medium ${r.done ? "text-ink-3" : "text-ink"}`}>{r.title}</span>
                  {r.snippet && <span className="mt-0.5 line-clamp-2 block text-ink-2">{r.snippet}</span>}
                  <span className="mt-1 block text-[13px] text-ink-3">
                    {TYPE_WORD[r.type]}
                    {r.done ? ", done" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
