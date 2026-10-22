"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/features/today/commands";
import { DELETE_PHRASE, DELETION_GRACE_DAYS, isDeletePhrase } from "./commands";

/** On success the real action redirects to the sign-in page and never returns. */
export type DeleteAccountAction = (phrase: string) => Promise<ActionResult>;

export type DeletionActions = {
  /** Asks for deletion in 14 days. */
  schedule: () => Promise<ActionResult>;
  undo: () => Promise<ActionResult>;
  deleteNow: DeleteAccountAction;
};

const quietButton =
  "rounded-lg border border-rule px-3.5 py-2 font-medium text-ink hover:bg-hover active:bg-press aria-disabled:cursor-default pointer-coarse:min-h-11";

/** `deletesOn` is the day a scheduled deletion falls due, or null when none is scheduled. */
export function DeleteAccountSection({ actions, deletesOn }: { actions: DeletionActions; deletesOn: string | null }) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="font-serif text-xl font-medium">
        Delete account
      </h2>
      <Scheduled actions={actions} deletesOn={deletesOn} />
      <DeleteNow action={actions.deleteNow} />
    </section>
  );
}

function Scheduled({ actions, deletesOn }: { actions: DeletionActions; deletesOn: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startChange] = useTransition();
  const id = useId();

  function change(action: () => Promise<ActionResult>) {
    if (pending) return;
    setMessage(null);
    startChange(async () => {
      const result = await action();
      if (!result.ok) setMessage(result.error);
    });
  }

  return (
    <div className="mt-1.5 max-w-[60ch]">
      {deletesOn ? (
        <p className="text-ink">
          Your account is scheduled for deletion on {deletesOn}. Until then it works as usual, and you can undo this
          here or from the notice at the top of every page.
        </p>
      ) : (
        <div className="space-y-2 text-ink-2">
          <p>
            This removes your account and everything in it: every item, note, checklist, area, tag and link. Axiis waits{" "}
            {DELETION_GRACE_DAYS} days before it deletes anything. Until then you can sign in as usual and undo it.
          </p>
          <p>If you might want any of it later, download your export first.</p>
        </div>
      )}
      <button
        type="button"
        aria-disabled={pending || undefined}
        aria-describedby={`${id}-status`}
        onClick={() => change(deletesOn ? actions.undo : actions.schedule)}
        className={`mt-4 ${quietButton}`}
      >
        {deletesOn ? (pending ? "Undoing" : "Undo deletion") : pending ? "Scheduling" : `Delete my account in ${DELETION_GRACE_DAYS} days`}
      </button>
      <p id={`${id}-status`} role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
        {message}
      </p>
    </div>
  );
}

function DeleteNow({ action }: { action: DeleteAccountAction }) {
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startDeleting] = useTransition();
  const id = useId();
  const ready = isDeletePhrase(phrase);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!ready) {
      setMessage(`Type ${DELETE_PHRASE} in the box first.`);
      return;
    }
    setMessage(null);
    startDeleting(async () => {
      const result = await action(phrase);
      setMessage(result.ok ? "Your account is deleted. Taking you to the sign-in page." : result.error);
    });
  }

  return (
    <div className="mt-6">
      <h3 id={`${id}-heading`} className="font-medium text-ink">
        Delete now
      </h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">
        If you do not want to wait, delete everything at once. This cannot be undone.
      </p>
      <form onSubmit={submit} autoComplete="off" aria-labelledby={`${id}-heading`} className="mt-3 max-w-[440px]">
        <label htmlFor={`${id}-phrase`} className="block text-ink">
          To confirm, type <span className="font-semibold">{DELETE_PHRASE}</span>
        </label>
        <input
          id={`${id}-phrase`}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-describedby={`${id}-status`}
          disabled={pending}
          className="mt-1.5 w-full rounded-lg border border-field bg-sheet px-3 py-2 text-ink disabled:opacity-60"
        />
        <button
          type="submit"
          aria-disabled={!ready || pending || undefined}
          className={`mt-3 rounded-lg border px-3.5 py-2 font-medium pointer-coarse:min-h-11 ${
            ready ? "border-ink bg-ink text-paper hover:bg-ink-2" : "border-rule text-ink-2 aria-disabled:cursor-default"
          }`}
        >
          {pending ? "Deleting your account" : "Delete now"}
        </button>
        <p id={`${id}-status`} role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
          {message}
        </p>
      </form>
    </div>
  );
}
