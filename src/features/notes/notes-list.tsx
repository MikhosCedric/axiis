"use client";

import { quickNote } from "@/features/actions/quick-item";
import { useQuick } from "@/features/actions/context";
import { RowActions, rowProps } from "@/features/actions/row-actions";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AreaMark } from "@/components/area-mark";
import { PlusIcon, SearchIcon } from "./icons";
import type { NoteRow, NotesActions } from "./model";
import { reach } from "@/lib/reach";
import { FilterChips } from "@/features/filter/filter-chip";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { NO_FILTER, type ViewFilter } from "@/features/filter/model";

const FILTER_DELAY_MS = 250;

/** The notes list: newest edit first, a quick "New note", and a search box that filters through full-text search. */
export function NotesList({
  rows,
  query,
  create,
  basePath = "/notes",
  filter = NO_FILTER,
}: {
  rows: NoteRow[];
  query: string;
  create: NotesActions["create"];
  basePath?: string;
  /** What the page narrowed its rows to; the rows passed in are already narrowed. */
  filter?: ViewFilter;
}) {
  const router = useRouter();
  const quick = useQuick();
  const keep = useKeepFilter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(query);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [filtering, startFilter] = useTransition();
  // Only a draft that differs from the address filters, so a mount (twice, under Strict Mode) never navigates.
  useEffect(() => {
    const q = draft.trim();
    if (q === query.trim()) return;
    const timer = setTimeout(() => {
      startFilter(() => router.replace(keep(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname), { scroll: false }));
    }, FILTER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, query, pathname, router, keep]);

  function newNote() {
    setError(null);
    startCreate(async () => {
      const result = await reach(create());
      if (result.ok) router.push(`${basePath}/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="max-w-[760px] px-4 pt-6 pb-16 rail:px-9 rail:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="headline">Notes</h1>
        <button
          type="button"
          onClick={newNote}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 font-medium text-paper hover:opacity-90 active:opacity-80 disabled:opacity-60 pointer-coarse:min-h-11"
        >
          <PlusIcon />
          New note
        </button>
      </div>
      <FilterChips filter={filter} className="mt-2.5" />

      <form role="search" action={pathname} onSubmit={(e) => e.preventDefault()} className="mt-6">
        <label htmlFor="notes-search" className="sr-only">
          Search notes
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">
            <SearchIcon />
          </span>
          <input
            id="notes-search"
            name="q"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="Search titles and the words inside"
            className="w-full rounded-lg border border-field bg-sheet py-2.5 pr-3 pl-9 text-ink"
          />
        </div>
      </form>
      <p role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
        {error ?? (creating ? "Making a note" : filtering ? "Searching" : "")}
      </p>

      {rows.length === 0 ? (
        <div className="mt-4 grid max-w-[760px] justify-items-center rounded-[18px] border border-dashed border-rule px-6 py-10 text-center">
          <svg aria-hidden="true" viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-ink-3">
            <path d="M6 3h9l4 4v14H6z" />
            <path d="M14 3v5h5M9 13h6M9 17h6" />
          </svg>
          <p className="max-w-[44ch] text-ink-2">
            {query
              ? `Nothing matches “${query}”. Try fewer words, or search everything from the search page.`
              : "No notes yet. Start one when something is worth keeping, and link it to the tasks it belongs to."}
          </p>
        </div>
      ) : (
        <ul className="surface mt-2 grid max-w-[760px] grid-cols-[minmax(0,1fr)] overflow-hidden px-3 py-1.5 [&_li:last-child]:border-b-0">
          {rows.map((r) => {
            const patch = quick?.patched(r.id);
            if (patch?.hidden) return null;
            const title = patch?.title ?? r.title;
            const qi = quickNote({ id: r.id, title, areaId: r.areaId });
            const hooks = { onOpen: () => router.push(`${basePath}/${r.id}`) };
            return (
            <li key={r.id} {...rowProps(quick, qi, hooks)} className="group/row relative border-b border-rule-soft">
              <Link href={`${basePath}/${r.id}`} data-quick-focus className="block rounded-md px-2 py-3 hover:bg-hover active:bg-press pointer-coarse:pr-14">
                <span className="block truncate font-medium text-ink">{title}</span>
                {r.firstLine && <span className="mt-0.5 block truncate text-ink-2">{r.firstLine}</span>}
                <span className="mt-1 block text-[13px] text-ink-3 tabular">
                  <AreaMark color={r.areaColor} className="mr-1.5 mb-px align-middle" />
                  {r.areaName ? `${r.areaName}, ${r.edited.charAt(0).toLowerCase()}${r.edited.slice(1)}` : r.edited}
                </span>
              </Link>
              <RowActions item={qi} hooks={hooks} className="absolute top-2 right-2 bg-paper" />
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
