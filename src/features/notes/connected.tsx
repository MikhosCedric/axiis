"use client";

import Link from "next/link";
import { startTransition, useEffect, useId, useOptimistic, useRef, useState } from "react";
import type { ActionResult } from "@/features/today/commands";
import { LinkIcon, UnlinkIcon } from "./icons";
import { TYPE_WORD, type ConnectedRow, type NotesActions, type SearchRow } from "./model";

const SEARCH_DELAY_MS = 200;

function rowMeta(row: { type: ConnectedRow["type"]; done: boolean; backlink?: boolean }) {
  return [TYPE_WORD[row.type], row.done ? "done" : null, row.backlink ? "links here" : null].filter(Boolean).join(", ");
}

/** Search-as-you-type list of items to link. Arrow keys move, Enter links, Escape closes. */
function LinkPicker({
  excludeIds,
  search,
  onPick,
  onClose,
}: {
  excludeIds: Set<string>;
  search: NotesActions["search"];
  onPick: (row: SearchRow) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; rows: SearchRow[] } | null>(null);
  const [active, setActive] = useState(0);
  const id = useId();

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let live = true;
    const timer = setTimeout(async () => {
      const rows = await search(q).catch(() => []);
      if (live) {
        setFound({ query: q, rows });
        setActive(0);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, search]);

  const results = query.trim() && found ? found.rows.filter((r) => !excludeIds.has(r.id)) : [];
  const open = results.length > 0;
  const optionId = (i: number) => `${id}-option-${i}`;
  const empty = query.trim() !== "" && found?.query === query.trim() && results.length === 0;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-input`} className="text-[13px] text-ink-3">
        Find a task or note to link
      </label>
      <input
        id={`${id}-input`}
        autoFocus
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open ? optionId(active) : undefined}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && open) {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp" && open) {
            e.preventDefault();
            setActive((a) => (a - 1 + results.length) % results.length);
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            onPick(results[active]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        autoComplete="off"
        placeholder="Search by title or words inside"
        className="w-full rounded-md border border-field bg-sheet px-2.5 py-1.5 text-ink"
      />
      <ul id={`${id}-list`} role="listbox" aria-label="Matching items" className={open ? "grid border-t border-rule-soft" : "hidden"}>
        {results.map((r, i) => (
          <li
            key={r.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(r)}
            onMouseEnter={() => setActive(i)}
            className="cursor-pointer border-b border-rule-soft px-2 py-1.5 aria-selected:bg-accent-wash"
          >
            <span className="block truncate">{r.title}</span>
            <span className="block text-[13px] text-ink-3">{rowMeta(r)}</span>
          </li>
        ))}
      </ul>
      {empty && <p className="text-[13px] text-ink-2">Nothing matches that yet.</p>}
    </div>
  );
}

type Change = { kind: "add"; row: ConnectedRow } | { kind: "remove"; linkId: string };

/** Items linked to this note, both ways, with a picker to add more. */
export function Connected({ noteId, rows, actions }: { noteId: string; rows: ConnectedRow[]; actions: NotesActions }) {
  const [shown, change] = useOptimistic(rows, (current: ConnectedRow[], c: Change) =>
    c.kind === "add" ? [...current, c.row] : current.filter((r) => r.linkId !== c.linkId),
  );
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  function write(optimistic: Change, save: () => Promise<ActionResult>, done: string) {
    setStatus(null);
    startTransition(async () => {
      change(optimistic);
      const result = await save();
      setStatus(result.ok ? done : result.error);
    });
  }

  function close() {
    setPicking(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="font-serif text-lg font-medium">
        Connected
      </h2>
      {shown.length === 0 ? (
        <p className="text-ink-2">Nothing linked yet. Link the tasks and notes this one is about.</p>
      ) : (
        <ul className="grid border-t border-rule-soft">
          {shown.map((r) => (
            <li key={r.linkId} className="flex items-center gap-2 border-b border-rule-soft py-1.5">
              <Link href={r.href} className="min-w-0 flex-1 rounded-md px-1 py-0.5 hover:bg-accent-wash">
                <span className={`block truncate ${r.done ? "text-ink-3" : ""}`}>{r.title}</span>
                <span className="block text-[13px] text-ink-3">{rowMeta(r)}</span>
              </Link>
              <button
                type="button"
                aria-label={`Unlink ${r.title}`}
                title="Unlink"
                onClick={() => write({ kind: "remove", linkId: r.linkId }, () => actions.unlink(r.linkId), "Unlinked.")}
                className="grid size-8 flex-none place-items-center rounded-md text-ink-3 hover:bg-accent-wash hover:text-ink"
              >
                <UnlinkIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {picking ? (
        <LinkPicker
          excludeIds={new Set([noteId, ...shown.map((r) => r.id)])}
          search={actions.search}
          onClose={close}
          onPick={(row) => {
            close();
            write(
              { kind: "add", row: { ...row, linkId: `pending-${row.id}`, backlink: false } },
              () => actions.link(noteId, row.id),
              `Linked ${row.title}.`,
            );
          }}
        />
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={() => setPicking(true)}
          className="-ml-2 inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-accent-wash hover:text-ink"
        >
          <LinkIcon />
          Link a task or note
        </button>
      )}
      <p role="status" className="min-h-5 text-[13px] text-ink-2">
        {status}
      </p>
    </section>
  );
}
