"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listNoteRows, loadNote, searchItems } from "@/features/notes/commands";
import type { NoteRow, NotesActions, NoteView, SearchRow } from "@/features/notes/model";
import { NoteEditor } from "@/features/notes/note-editor";
import { NotesList } from "@/features/notes/notes-list";
import { SearchView } from "@/features/notes/search-view";
import { actions, BASE, harnessHref, settings, store } from "./store";

function Bar() {
  const [failing, setFailing] = useState(settings.failing);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-soft bg-paper-2 px-4 py-2 text-[13px] text-ink-2 rail:px-9">
      <span>Notes harness, in memory</span>
      <Link href={BASE} className="underline underline-offset-3">
        List
      </Link>
      <Link href={`${BASE}/search`} className="underline underline-offset-3">
        Search
      </Link>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={failing}
          onChange={(e) => {
            settings.failing = e.target.checked;
            setFailing(e.target.checked);
          }}
        />
        Make every save fail
      </label>
    </div>
  );
}

/** Loads with `load` now and again after every write, standing in for the server's refresh. */
function useLoaded<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | undefined>(undefined);
  const reload = useCallback(() => {
    void load().then(setValue);
  }, [load]);
  useEffect(reload, [reload]);
  return [value, reload] as const;
}

export function HarnessList({ query, timeZone }: { query: string; timeZone: string }) {
  const load = useCallback(() => listNoteRows(store.notes, store.items, query || null, new Date(), timeZone), [query, timeZone]);
  const [rows] = useLoaded<NoteRow[]>(load);
  return (
    <>
      <Bar />
      {rows && <NotesList rows={rows} query={query} create={actions.create} basePath={BASE} />}
    </>
  );
}

export function HarnessEditor({ noteId, timeZone }: { noteId: string; timeZone: string }) {
  const load = useCallback(async () => {
    const view = await loadNote(store.notes, store.items, noteId, new Date(), timeZone);
    return view && { ...view, connected: view.connected.map((c) => ({ ...c, href: harnessHref(c) })) };
  }, [noteId, timeZone]);
  const [view, reload] = useLoaded<NoteView | null>(load);
  const withReload = <A extends unknown[], R>(write: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      const result = await write(...args);
      reload();
      return result;
    };
  const reloading: NotesActions = {
    ...actions,
    setArea: withReload(actions.setArea),
    link: withReload(actions.link),
    unlink: withReload(actions.unlink),
  };
  return (
    <>
      <Bar />
      {view === null && <p className="px-4 pt-8 text-ink-2 rail:px-9">That note is not here any more.</p>}
      {view && <NoteEditor key={view.note.id} view={view} actions={reloading} basePath={BASE} />}
    </>
  );
}

export function HarnessSearch({ query }: { query: string }) {
  const load = useCallback(
    async () => (await searchItems(store.notes, store.items, query)).map((r): SearchRow => ({ ...r, href: harnessHref(r) })),
    [query],
  );
  const [rows] = useLoaded<SearchRow[]>(load);
  return (
    <>
      <Bar />
      <SearchView query={query} rows={rows ?? []} basePath={`${BASE}/search`} />
    </>
  );
}
