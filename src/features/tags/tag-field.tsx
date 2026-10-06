"use client";

import Link from "next/link";
import { startTransition, useId, useOptimistic, useState, type KeyboardEvent } from "react";
import { parseTagName, sameTag, TAG_NAME_MAX, type TagName } from "@/domain/tag";
import { CloseIcon } from "@/features/detail/icons";
import type { ActionResult } from "@/features/today/commands";
import { suggestTags, tagHref } from "./model";

type Change = { kind: "add" | "remove"; name: TagName };

/**
 * The detail panel's Tags section: the item's tags as chips that can be taken
 * off, and a field that adds one on Enter, offering existing tags as it goes.
 */
export function TagField({
  itemId,
  tags,
  known,
  series,
  add,
  remove,
}: {
  itemId: string;
  tags: TagName[];
  known: TagName[];
  /** The item is one time a series happens, so its tags are the whole series'. */
  series: boolean;
  add: (id: string, name: string) => Promise<ActionResult>;
  remove: (id: string, name: string) => Promise<ActionResult>;
}) {
  const [shown, change] = useOptimistic(tags, (current: TagName[], c: Change) =>
    c.kind === "add" ? [...current, c.name] : current.filter((t) => !sameTag(t, c.name)),
  );
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const headingId = useId();
  const fieldId = useId();
  const listId = useId();
  const hintId = useId();

  const suggestions = open ? suggestTags(known, shown, input) : [];
  const optionId = (i: number) => `${listId}-${i}`;

  function save(c: Change, done: string) {
    setStatus("");
    startTransition(async () => {
      change(c);
      const result = await (c.kind === "add" ? add : remove)(itemId, c.name);
      setStatus(result.ok ? done : result.error);
    });
  }

  function addTyped(raw: string) {
    const name = parseTagName(raw);
    if (!name) {
      setStatus(raw.trim() ? `A tag needs 1 to ${TAG_NAME_MAX} characters.` : "");
      return;
    }
    setInput("");
    setActive(-1);
    const existing = known.find((t) => sameTag(t, name)) ?? name;
    if (shown.some((t) => sameTag(t, existing))) {
      setStatus(`Already tagged ${existing}.`);
      return;
    }
    save({ kind: "add", name: existing }, `Tagged ${existing}.`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = suggestTags(known, shown, input).length;
      if (n === 0) return;
      setOpen(true);
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      addTyped(active >= 0 && suggestions[active] ? suggestions[active] : input);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-2 border-t border-rule pt-4">
      <h3 id={headingId} className="font-serif text-lg font-medium">
        Tags
      </h3>
      {series && (
        <p id={hintId} className="text-[13px] text-ink-3">
          Tags belong to every time it repeats.
        </p>
      )}
      {shown.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((name) => (
            <li key={name} className="inline-flex items-center rounded-full border border-rule text-[13px] text-ink-2">
              <Link href={tagHref(name)} className="rounded-l-full py-0.5 pr-1 pl-2.5 hover:text-ink">
                #{name}
              </Link>
              <button
                type="button"
                aria-label={`Remove tag ${name}`}
                title="Remove"
                onClick={() => save({ kind: "remove", name }, `Took ${name} off.`)}
                className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-accent-wash hover:text-ink"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <label htmlFor={fieldId} className="sr-only">
          Add a tag
        </label>
        <input
          id={fieldId}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && suggestions[active] ? optionId(active) : undefined}
          aria-describedby={series ? hintId : undefined}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={TAG_NAME_MAX + 8}
          placeholder="Add a tag"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-field bg-sheet px-3 py-2 text-ink"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Tags you have"
          hidden={suggestions.length === 0}
          className="absolute inset-x-0 top-full z-10 mt-1 grid rounded-lg border border-rule bg-sheet py-1 shadow-sm"
        >
          {suggestions.map((name, i) => (
            <li
              key={name}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // Keeps focus in the field, so the list does not close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTyped(name)}
              className="cursor-pointer px-3 py-1.5 text-ink-2 hover:bg-accent-wash hover:text-ink aria-selected:bg-accent-wash aria-selected:text-ink"
            >
              #{name}
            </li>
          ))}
        </ul>
      </div>
      <p role="status" className="min-h-5 text-[13px] text-ink-2">
        {status}
      </p>
    </section>
  );
}
