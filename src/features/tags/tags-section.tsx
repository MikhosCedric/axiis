"use client";

import Link from "next/link";
import { startTransition, useId, useOptimistic, useState } from "react";
import { parseTagName, TAG_NAME_MAX, type TagId, type TagName, type TagSummary } from "@/domain/tag";
import { ConfirmDelete } from "@/features/detail/confirm-delete";
import type { ActionResult } from "@/features/today/commands";
import { openCount, tagHref } from "./model";

export type TagActions = {
  rename(id: string, name: string): Promise<ActionResult>;
  remove(id: string): Promise<ActionResult>;
};

type Change = { kind: "rename"; id: TagId; name: TagName } | { kind: "remove"; id: TagId };

function apply(tags: TagSummary[], change: Change): TagSummary[] {
  return change.kind === "rename"
    ? tags.map((t) => (t.id === change.id ? { ...t, name: change.name } : t))
    : tags.filter((t) => t.id !== change.id);
}

/** Every tag, renamed in place or deleted. Tags are added from an item, so there is no add here. */
export function TagsSection({
  tags,
  actions,
  hrefFor = tagHref,
}: {
  tags: TagSummary[];
  actions: TagActions;
  hrefFor?: (name: string) => string;
}) {
  const [shown, change] = useOptimistic(tags, apply);
  const [error, setError] = useState<string | null>(null);
  const prefix = useId();

  function run(optimistic: Change, work: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      change(optimistic);
      const result = await work();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section aria-labelledby={`${prefix}-heading`}>
      <h2 id={`${prefix}-heading`} className="font-serif text-xl font-medium">
        Tags
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">
        Renaming a tag renames it on every item. Deleting one takes it off its items and keeps the items.
      </p>

      {shown.length > 0 ? (
        <ul className="mt-4 border-t border-rule">
          {shown.map((tag) => (
            <li
              key={tag.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1 border-b border-rule-soft py-1"
            >
              <TagName
                tag={tag}
                onSave={(name) => run({ kind: "rename", id: tag.id, name }, () => actions.rename(tag.id, name))}
                onError={setError}
              />
              <Link
                href={hrefFor(tag.name)}
                className="inline-flex items-center rounded-md px-2 py-1.5 text-[13px] whitespace-nowrap text-ink-3 tabular hover:bg-hover active:bg-press hover:text-ink pointer-coarse:min-h-11"
              >
                {openCount(tag.open)}
                <span className="sr-only"> with #{tag.name}</span>
              </Link>
              <ConfirmDelete
                compact
                label={`Delete #${tag.name}`}
                prompt={`Delete #${tag.name}? Its items stay.`}
                onConfirm={() => run({ kind: "remove", id: tag.id }, () => actions.remove(tag.id))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-y border-rule py-3 text-ink-2">No tags yet. Add one from any item&rsquo;s details.</p>
      )}

      <p role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
        {error}
      </p>
    </section>
  );
}

/**
 * The tag's name, editable in place. Enter or leaving the field saves; Escape puts the saved name back.
 * `draft` is null whenever there is nothing unsaved, so a blur after Enter does not save twice.
 */
function TagName({
  tag,
  onSave,
  onError,
}: {
  tag: TagSummary;
  onSave: (name: TagName) => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(text: string) {
    const name = parseTagName(text);
    setDraft(null);
    if (name === tag.name) return;
    if (!name) {
      onError("A tag needs a name, so the old one is back.");
      return;
    }
    onSave(name);
  }

  return (
    <input
      value={draft ?? tag.name}
      aria-label={`Rename #${tag.name}`}
      title={tag.name}
      maxLength={TAG_NAME_MAX}
      spellCheck={draft !== null}
      autoComplete="off"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== null && commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          setDraft(null);
          onError(null);
        }
      }}
      className="w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[15px] text-ink hover:border-rule-soft focus:border-field focus:bg-sheet"
    />
  );
}
