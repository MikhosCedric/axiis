"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { LinkPicker } from "@/features/notes/connected";
import { LinkIcon, PlusIcon, UnlinkIcon } from "@/features/notes/icons";
import type { ConnectedRow } from "@/features/notes/model";
import type { ActionResult } from "@/features/today/commands";
import type { DetailActions } from "./model";
import { reach } from "@/lib/reach";

/** Notes linked to the selected item, with a way to start a new one already linked. */
export function LinkedNotes({ itemId, notes, actions }: { itemId: string; notes: ConnectedRow[]; actions: DetailActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { linkNote, unlinkNote, searchNotes } = actions;

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

  return (
    <section aria-labelledby={headingId} className="grid gap-1.5">
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        Notes
      </h3>
      {notes.length > 0 && (
        <ul className="grid grid-cols-[minmax(0,1fr)]">
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
                  className="grid size-8 flex-none place-items-center rounded-md text-ink-3 hover:bg-hover active:bg-press hover:text-ink pointer-coarse:size-11"
                >
                  <UnlinkIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={newNote}
        disabled={pending}
        className="-ml-2 inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-hover active:bg-press hover:text-ink disabled:opacity-60"
      >
        <PlusIcon />
        New note linked to this
      </button>
      {linkNote && searchNotes && (picking ? (
        <LinkPicker
          excludeIds={new Set([itemId, ...notes.map((n) => n.id)])}
          search={searchNotes}
          onClose={() => setPicking(false)}
          onPick={(row) => {
            setPicking(false);
            write(linkNote(itemId, row.id), `Linked ${row.title}.`);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="-ml-2 inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-hover active:bg-press hover:text-ink"
        >
          <LinkIcon />
          Link an existing note or task
        </button>
      ))}
      <p role="status" className="min-h-5 text-[13px] text-ink-2">
        {error ?? done ?? (pending ? "Working" : "")}
      </p>
    </section>
  );
}
