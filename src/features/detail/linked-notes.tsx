"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { PlusIcon } from "@/features/notes/icons";
import type { ConnectedRow } from "@/features/notes/model";
import type { DetailActions } from "./model";

/** Notes linked to the selected item, with a way to start a new one already linked. */
export function LinkedNotes({ itemId, notes, actions }: { itemId: string; notes: ConnectedRow[]; actions: DetailActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();

  function newNote() {
    setError(null);
    start(async () => {
      const result = await actions.newLinkedNote(itemId);
      if (result.ok) router.push(`/notes/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-2 border-t border-rule pt-4">
      <h3 id={headingId} className="text-[13px] font-semibold text-ink-2">
        Notes
      </h3>
      {notes.length > 0 && (
        <ul className="grid">
          {notes.map((n) => (
            <li key={n.linkId}>
              <Link href={n.href} className="-ml-2 block truncate rounded-md px-2 py-1 hover:bg-accent-wash">
                {n.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={newNote}
        disabled={pending}
        className="-ml-2 inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-accent-wash hover:text-ink disabled:opacity-60"
      >
        <PlusIcon />
        New note linked to this
      </button>
      <p role="status" className="min-h-5 text-[13px] text-ink-2">
        {error ?? (pending ? "Making a note" : "")}
      </p>
    </section>
  );
}
