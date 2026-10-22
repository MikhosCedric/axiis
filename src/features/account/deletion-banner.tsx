"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";

/** Shown at the top of every signed-in page while the account waits for deletion. */
export function DeletionBanner({ deletesOn, undo }: { deletesOn: string; undo: () => Promise<ActionResult> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startUndo] = useTransition();

  return (
    <section
      aria-label="Account deletion"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule bg-paper-2 px-4 py-2.5 text-ink rail:px-9"
    >
      <p>Your account is scheduled for deletion on {deletesOn}.</p>
      <button
        type="button"
        aria-disabled={pending || undefined}
        onClick={() => {
          if (pending) return;
          startUndo(async () => {
            const result = await reach(undo());
            setMessage(result.ok ? null : result.error);
          });
        }}
        className="rounded-md px-1.5 py-0.5 font-medium text-ink underline underline-offset-4 hover:bg-hover active:bg-press pointer-coarse:min-h-11"
      >
        {pending ? "Undoing" : "Undo"}
      </button>
      <p role="status" className="text-[13px] text-ink-2">
        {message}
      </p>
    </section>
  );
}
