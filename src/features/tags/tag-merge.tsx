"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { TagId, TagSummary } from "@/domain/tag";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";
import type { MergePreview } from "./commands";
import { mergePrompt } from "./model";

export type MergeActions = {
  preview(sourceId: string, targetId: string): Promise<MergePreview>;
  merge(sourceId: string, targetId: string): Promise<ActionResult>;
};

/** Two lines meeting in one: the merge button's mark, in the rail's stroke. */
export function MergeIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3c0 4 5 4 5 7v3M13 3c0 4-5 4-5 7" />
    </svg>
  );
}

const quiet = "rounded-md px-2.5 py-1.5 font-medium hover:bg-hover active:bg-press pointer-coarse:min-h-11";

/**
 * Below a tag's row: choose the tag to merge it into, then a plain confirm that says how many items change and that it
 * cannot be undone. The count is read when asked, so it is exact however many items wear the tag.
 */
export function MergePanel({
  id,
  tag,
  others,
  actions,
  onClose,
  onMerged,
}: {
  id: string;
  tag: Pick<TagSummary, "id" | "name">;
  others: readonly Pick<TagSummary, "id" | "name">[];
  actions: MergeActions;
  onClose: () => void;
  onMerged: (target: Pick<TagSummary, "id" | "name">) => void;
}) {
  const [targetId, setTargetId] = useState<TagId>(others[0]?.id ?? ("" as TagId));
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const target = others.find((t) => t.id === targetId) ?? null;

  useEffect(() => {
    if (count === null) select.current?.focus();
    else cancel.current?.focus();
  }, [count]);

  function ask() {
    if (!target) return;
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await reach(actions.preview(tag.id, target.id));
      setBusy(false);
      if (result.ok) setCount(result.count);
      else setError(result.error);
    });
  }

  function merge() {
    if (!target) return;
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await reach(actions.merge(tag.id, target.id));
      setBusy(false);
      if (result.ok) onMerged(target);
      else setError(result.error);
    });
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={`Merge #${tag.name}`}
      aria-busy={busy || undefined}
      className="col-span-full mt-1 mb-2 px-2 text-[14px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {count === null ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <label htmlFor={`${id}-into`} className="text-ink-2">
            Merge #{tag.name} into
          </label>
          <select
            ref={select}
            id={`${id}-into`}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value as TagId)}
            className="min-w-0 rounded-md border border-field bg-sheet px-2 py-1.5 text-ink pointer-coarse:min-h-11"
          >
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={ask} disabled={busy || !target} className={`${quiet} border border-rule text-ink disabled:opacity-60`}>
            Continue
          </button>
          <button type="button" onClick={onClose} className={`${quiet} text-ink-2`}>
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <p className="max-w-[60ch] text-ink">{mergePrompt(tag.name, target?.name ?? "", count)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1">
            <button
              type="button"
              onClick={merge}
              disabled={busy}
              className={`${quiet} -ml-2.5 text-ink underline decoration-rule underline-offset-3 disabled:opacity-60`}
            >
              Merge into #{target?.name}
            </button>
            <button ref={cancel} type="button" onClick={onClose} className={`${quiet} text-ink-2`}>
              Keep both
            </button>
          </div>
        </div>
      )}
      <p role="status" className="mt-1 min-h-5 text-[13px] text-ink-2">
        {error}
      </p>
    </div>
  );
}
