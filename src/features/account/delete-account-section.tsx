"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/features/today/commands";
import { DELETE_PHRASE, isDeletePhrase } from "./commands";

/** On success the real action redirects to the sign-in page and never returns. */
export type DeleteAccountAction = (phrase: string) => Promise<ActionResult>;

export function DeleteAccountSection({ action }: { action: DeleteAccountAction }) {
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
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="font-serif text-xl font-medium">
        Delete account
      </h2>
      <div className="mt-1.5 max-w-[60ch] space-y-2 text-ink-2">
        <p>
          This removes your account and everything in it: every item, note, checklist, area, tag and link. It happens at
          once and cannot be undone.
        </p>
        <p>If you might want any of it later, download your export first.</p>
      </div>

      <form onSubmit={submit} autoComplete="off" className="mt-4 max-w-[440px]">
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
          className={`mt-3 rounded-lg border px-3.5 py-2 font-medium ${
            ready ? "border-ink bg-ink text-paper hover:bg-ink-2" : "border-rule text-ink-2 aria-disabled:cursor-default"
          }`}
        >
          {pending ? "Deleting your account" : "Delete my account"}
        </button>
        <p id={`${id}-status`} role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
          {message}
        </p>
      </form>
    </section>
  );
}
