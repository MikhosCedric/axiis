"use client";

import { startTransition, useId, useOptimistic, useRef, useState, type FormEvent } from "react";
import type { ActionResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { ConfirmDelete } from "./confirm-delete";
import { GlyphCheckbox } from "./glyph-checkbox";
import { LiftIcon } from "./icons";
import { InlineTitle } from "./inline-title";
import { progressLine, type DetailActions, type DetailSubtask } from "./model";

/** A pending row has a client id until the server render brings the real one. */
type Row = { id: string; title: string; done: boolean; pending?: true };
type Change = { kind: "add"; row: Row } | { kind: "toggle"; id: string; done: boolean } | { kind: "remove"; id: string };

function apply(rows: Row[], change: Change): Row[] {
  switch (change.kind) {
    case "add":
      return [...rows, change.row];
    case "toggle":
      return rows.map((r) => (r.id === change.id ? { ...r, done: change.done } : r));
    case "remove":
      return rows.filter((r) => r.id !== change.id);
  }
}

export function Subtasks({
  parentId,
  parentDone,
  subtasks,
  actions,
  onMarkParentDone,
}: {
  parentId: string;
  parentDone: boolean;
  subtasks: DetailSubtask[];
  actions: DetailActions;
  onMarkParentDone: () => void;
}) {
  const [rows, change] = useOptimistic<Row[], Change>(subtasks, apply);
  const [status, setStatus] = useState<string | null>(null);
  const [offer, setOffer] = useState(false);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const addField = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const fieldId = useId();

  const progress = progressLine(rows);
  const showOffer = offer && !parentDone && rows.length > 0 && rows.every((r) => r.done);

  function write(optimistic: Change, save: () => Promise<ActionResult>, done?: string) {
    setStatus(null);
    startTransition(async () => {
      change(optimistic);
      const result = await save();
      setStatus(result.ok ? (done ?? null) : result.error);
      if (!result.ok) setOffer(false);
    });
  }

  function toggle(id: string, next: boolean) {
    setJustDone(next ? id : null);
    setOffer(next && !parentDone && rows.every((r) => r.id === id || r.done));
    write({ kind: "toggle", id, done: next }, () => actions.setDone(id, next));
  }

  function lift(id: string) {
    addField.current?.focus();
    write({ kind: "remove", id }, () => actions.promote(id), "Now a task of its own, waiting for a time.");
  }

  function remove(id: string) {
    addField.current?.focus();
    write({ kind: "remove", id }, () => actions.remove(id), "Deleted.");
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    // Clear at once so the next subtask can be typed while this one saves.
    setDraft("");
    setStatus(null);
    startTransition(async () => {
      change({ kind: "add", row: { id: `pending:${crypto.randomUUID()}`, title, done: false, pending: true } });
      const result = await actions.addSubtask(parentId, title);
      if (!result.ok) {
        setDraft((current) => current || title);
        setStatus(result.error);
      }
    });
  }

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h3 id={headingId} className="font-serif text-lg font-medium">
          Subtasks
        </h3>
        {progress && <p className="text-[13px] text-ink-2 tabular">{progress}</p>}
      </div>

      {rows.length > 0 && (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-rule-soft py-1.5"
            >
              <GlyphCheckbox
                type="task"
                done={row.done}
                justDone={justDone === row.id}
                label={row.title}
                disabled={row.pending}
                onChange={(next) => toggle(row.id, next)}
              />
              {row.pending ? (
                <span className="px-1.5 py-1 break-words text-ink-3">{row.title}</span>
              ) : (
                <InlineTitle
                  value={row.title}
                  label="Subtask title"
                  onSave={(title) => actions.rename(row.id, title)}
                  onError={setStatus}
                  className={row.done ? "text-ink-3" : "text-ink"}
                />
              )}
              {!row.pending && (
                <span className="flex items-center">
                  <button
                    type="button"
                    aria-label={`Make ${row.title} a task`}
                    title="Make it a task"
                    onClick={() => lift(row.id)}
                    className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-accent-wash hover:text-ink"
                  >
                    <LiftIcon />
                  </button>
                  <ConfirmDelete compact label={`Delete ${row.title}`} prompt="Delete?" onConfirm={() => remove(row.id)} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite">
        {showOffer && (
          <p className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-rule-soft py-2.5 text-ink-2">
            <span className="mr-1">Every subtask is done.</span>
            <button
              type="button"
              onClick={() => {
                setOffer(false);
                onMarkParentDone();
              }}
              className="rounded-md px-2 py-1 font-medium text-ink underline decoration-rule underline-offset-3 hover:bg-accent-wash"
            >
              Mark this done too
            </button>
            <button
              type="button"
              onClick={() => setOffer(false)}
              className="rounded-md px-2 py-1 font-medium hover:bg-accent-wash"
            >
              Not yet
            </button>
          </p>
        )}
      </div>

      <form onSubmit={add} autoComplete="off" className="mt-3">
        <label htmlFor={fieldId} className="sr-only">
          Add a subtask
        </label>
        <input
          ref={addField}
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="Add a subtask"
          className="w-full rounded-lg border border-field bg-sheet px-3 py-2 text-ink"
        />
      </form>
      <p role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
        {status}
      </p>
    </section>
  );
}
