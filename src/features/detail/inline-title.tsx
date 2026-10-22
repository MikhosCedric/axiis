"use client";

import { startTransition, useOptimistic, useState } from "react";
import type { ActionResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { reach } from "@/lib/reach";

/**
 * A title that reads as text and edits in place. Enter or leaving the field
 * saves, Escape puts the saved title back. The new title shows at once and
 * rolls back if the save fails.
 */
export function InlineTitle({
  value,
  label,
  onSave,
  onError,
  className = "",
}: {
  value: string;
  label: string;
  onSave: (title: string) => Promise<ActionResult>;
  onError: (message: string | null) => void;
  className?: string;
}) {
  const [shown, setShown] = useOptimistic(value);
  const [draft, setDraft] = useState<string | null>(null);

  function commit(text: string) {
    const next = text.trim();
    if (next === shown) return;
    if (!next) {
      setDraft((d) => (d === null ? null : shown));
      onError("A title needs a few words, so the old one is back.");
      return;
    }
    onError(null);
    startTransition(async () => {
      setShown(next);
      const result = await reach(onSave(next));
      if (!result.ok) {
        onError(result.error);
        setDraft((d) => (d === null ? null : value));
      }
    });
  }

  return (
    <textarea
      rows={1}
      value={draft ?? shown}
      aria-label={label}
      maxLength={TITLE_MAX}
      spellCheck={draft !== null}
      onFocus={() => setDraft(shown)}
      onChange={(e) => setDraft(e.target.value.replace(/\s*\n\s*/g, " "))}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(shown);
          onError(null);
        }
      }}
      className={`block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1.5 py-1 [field-sizing:content] hover:border-rule-soft focus:border-field focus:bg-sheet ${className}`}
    />
  );
}
