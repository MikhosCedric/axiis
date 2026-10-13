"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PlusIcon, SearchIcon } from "./icons";
import type { NoteRow, NotesActions } from "./model";

const FILTER_DELAY_MS = 250;

/** The notes list: newest edit first, a quick "New note", and a search box that filters through full-text search. */
export function NotesList({
  rows,
  query,
  create,
  basePath = "/notes",
}: {
  rows: NoteRow[];
  query: string;
  create: NotesActions["create"];
  basePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(query);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [filtering, startFilter] = useTransition();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const q = draft.trim();
      startFilter(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }));
    }, FILTER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, pathname, router]);

  function newNote() {
    setError(null);
    startCreate(async () => {
      const result = await create();
      if (result.ok) router.push(`${basePath}/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="max-w-[760px] px-4 pt-6 pb-16 rail:px-9 rail:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]">Notes</h1>
        <button
          type="button"
          onClick={newNote}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 font-medium text-paper hover:opacity-90 disabled:opacity-60"
        >
          <PlusIcon />
          New note
        </button>
      </div>

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
        <p className="mt-6 max-w-[52ch] text-ink-2">
          {query
            ? `Nothing matches “${query}”. Try fewer words, or search everything from the search page.`
            : "No notes yet. Start one when something is worth keeping, and link it to the tasks it belongs to."}
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] border-t border-rule">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-rule-soft">
              <Link href={`${basePath}/${r.id}`} className="block rounded-md px-2 py-3 hover:bg-accent-wash">
                <span className="block truncate font-medium text-ink">{r.title}</span>
                {r.firstLine && <span className="mt-0.5 block truncate text-ink-2">{r.firstLine}</span>}
                <span className="mt-1 block text-[13px] text-ink-3 tabular">
                  {r.areaName ? `${r.areaName}, ${r.edited.charAt(0).toLowerCase()}${r.edited.slice(1)}` : r.edited}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
