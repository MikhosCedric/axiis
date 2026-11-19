"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { LinkPicker } from "@/features/notes/connected";
import { PlusIcon, UnlinkIcon } from "@/features/notes/icons";
import type { ConnectedRow } from "@/features/notes/model";
import type { ActionResult } from "@/features/today/commands";
import { NoteIcon } from "./icons";
import type { DetailActions } from "./model";
import { reach } from "@/lib/reach";

/** Notes linked to the selected item. One "+" adds one: find an existing note or task, or start a new note already linked. */
export function LinkedNotes({ itemId, notes, actions }: { itemId: string; notes: ConnectedRow[]; actions: DetailActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { linkNote, unlinkNote, searchNotes } = actions;
  const canLink = Boolean(linkNote && searchNotes);

  function write(work: Promise<ActionResult>, message: string) {
    setError(null);
    setDone(null);
    start(async () => {
      const result = await reach(work);
      if (result.ok) setDone(message);
      else setError(result.error);
    });
  }

  function newNote() {
    setError(null);
    start(async () => {
      const result = await reach(actions.newLinkedNote(itemId));
      if (result.ok) router.push(`/notes/${result.id}`);
      else setError(result.error);
    });
  }

  const tool =
    "grid size-8 flex-none place-items-center rounded-md text-ink-3 hover:bg-hover active:bg-press hover:text-ink disabled:opacity-60 pointer-coarse:size-11";

  return (
    <section aria-labelledby={headingId} className="grid gap-0.5">
      <div className="flex min-h-9 items-center gap-3 pointer-coarse:min-h-11">
        <span aria-hidden="true" className="grid w-4 place-items-center text-ink-3">
          <NoteIcon />
        </span>
        <h3 id={headingId} className="min-w-0 flex-1 text-[13px] font-medium text-ink-2">
          Notes
        </h3>
        <button
          type="button"
          onClick={() => (canLink ? setPicking(true) : newNote())}
          disabled={pending}
          aria-label="Add a note"
          title="Add a note"
          aria-expanded={canLink ? picking : undefined}
          className={tool}
        >
          <PlusIcon />
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="grid grid-cols-[minmax(0,1fr)] pl-7">
          {notes.map((n) => (
            <li key={n.linkId} className="flex items-center gap-1">
              <Link href={n.href} className="-ml-2 block min-w-0 flex-1 truncate rounded-md px-2 py-1 hover:bg-hover active:bg-press">
                {n.title}
              </Link>
              {unlinkNote && (
                <button
                  type="button"
                  aria-label={`Unlink ${n.title}`}
                  title="Unlink"
                  disabled={pending}
                  onClick={() => write(unlinkNote(n.linkId), `Unlinked ${n.title}.`)}
                  className={tool}
                >
                  <UnlinkIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {linkNote && searchNotes && picking && (
        <div className="grid gap-1.5 pl-7">
          <LinkPicker
            excludeIds={new Set([itemId, ...notes.map((n) => n.id)])}
            search={searchNotes}
            onClose={() => setPicking(false)}
            onPick={(row) => {
              setPicking(false);
              write(linkNote(itemId, row.id), `Linked ${row.title}.`);
            }}
          />
          {/* The mouse press is held back so the picker does not close on blur before the click lands. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={newNote}
            disabled={pending}
            className="justify-self-start rounded-md px-2 py-1 text-[13px] font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:min-h-11"
          >
            New note
          </button>
        </div>
      )}
      <p role="status" className="pl-7 text-[13px] text-ink-2 empty:hidden">
        {error ?? done ?? (pending ? "Working" : "")}
      </p>
    </section>
  );
}
