"use client";

import { startTransition, useEffect, useId, useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import type { Area, AreaId } from "@/domain/item";
import { ConfirmDelete } from "@/features/detail/confirm-delete";
import type { ActionResult } from "@/features/today/commands";
import { AREA_LIMIT, AREA_NAME_MAX, moved, type MoveDirection } from "./commands";
import { ArrowIcon } from "./icons";

export type AreaActions = {
  add(name: string): Promise<ActionResult>;
  rename(id: string, name: string): Promise<ActionResult>;
  remove(id: string): Promise<ActionResult>;
  move(id: string, direction: MoveDirection): Promise<ActionResult>;
};

type Change =
  | { kind: "move"; id: AreaId; direction: MoveDirection }
  | { kind: "rename"; id: AreaId; name: string }
  | { kind: "remove"; id: AreaId };

function apply(areas: Area[], change: Change): Area[] {
  switch (change.kind) {
    case "move": {
      const ids = moved(
        areas.map((a) => a.id),
        change.id,
        change.direction,
      );
      return ids ? ids.map((id) => areas.find((a) => a.id === id)!) : areas;
    }
    case "rename":
      return areas.map((a) => (a.id === change.id ? { ...a, name: change.name } : a));
    case "remove":
      return areas.filter((a) => a.id !== change.id);
  }
}

const iconButton =
  "grid size-8 pointer-coarse:size-11 place-items-center rounded-md text-ink-3 hover:bg-accent-wash hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink-3";

export function AreasSection({ areas, actions }: { areas: Area[]; actions: AreaActions }) {
  const [shown, change] = useOptimistic(areas, apply);
  const [error, setError] = useState<string | null>(null);
  const prefix = useId();
  const refocus = useRef<{ id: AreaId; direction: MoveDirection } | null>(null);
  const moveButtonId = (id: AreaId, direction: MoveDirection) => `${prefix}-${direction}-${id}`;

  // Moving a row can take the pressed button out of the document and drop focus to the body; put it back.
  useEffect(() => {
    const target = refocus.current;
    if (target && (document.activeElement === null || document.activeElement === document.body)) {
      document.getElementById(moveButtonId(target.id, target.direction))?.focus();
    }
  });

  function run(optimistic: Change | null, work: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      if (optimistic) change(optimistic);
      const result = await work();
      if (!result.ok) setError(result.error);
    });
  }

  function move(id: AreaId, direction: MoveDirection, index: number) {
    const atEnd = direction === "up" ? index === 0 : index === shown.length - 1;
    if (atEnd) return;
    refocus.current = { id, direction };
    run({ kind: "move", id, direction }, () => actions.move(id, direction));
  }

  return (
    <section aria-labelledby={`${prefix}-heading`} onPointerDown={() => (refocus.current = null)}>
      <h2 id={`${prefix}-heading`} className="font-serif text-xl font-medium">
        Areas
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">
        Each area is a staff on the Score. Removing one keeps its items; they show under No area.
      </p>

      {shown.length > 0 ? (
        <ul className="mt-4 border-t border-rule">
          {shown.map((area, index) => (
            <li
              key={area.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 border-b border-rule-soft py-1"
            >
              <AreaName
                area={area}
                onSave={(name) => run({ kind: "rename", id: area.id, name }, () => actions.rename(area.id, name))}
                onError={setError}
              />
              <span className="group/actions flex items-center">
                {(["up", "down"] as const).map((direction) => {
                  const atEnd = direction === "up" ? index === 0 : index === shown.length - 1;
                  return (
                    <button
                      key={direction}
                      id={moveButtonId(area.id, direction)}
                      type="button"
                      aria-label={`Move ${area.name} ${direction}`}
                      title={`Move ${direction}`}
                      aria-disabled={atEnd || undefined}
                      onClick={() => move(area.id, direction, index)}
                      className={`${iconButton} group-has-[[role=group]]/actions:hidden`}
                    >
                      <ArrowIcon direction={direction} />
                    </button>
                  );
                })}
                <ConfirmDelete
                  compact
                  label={`Remove ${area.name}`}
                  prompt={`Remove ${area.name}?`}
                  onConfirm={() => run({ kind: "remove", id: area.id }, () => actions.remove(area.id))}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-y border-rule py-3 text-ink-2">No areas yet. Everything sits under No area until you add one.</p>
      )}

      <p role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-2">
        {error}
      </p>

      {shown.length < AREA_LIMIT ? (
        <AddArea onAdd={actions.add} onError={setError} />
      ) : (
        <p className="text-ink-2">You have {AREA_LIMIT} areas, the most Axiis keeps. Remove one to add another.</p>
      )}
    </section>
  );
}

/**
 * The area's name, editable in place. Enter or leaving the field saves; Escape puts the saved name back.
 * `draft` is null whenever there is nothing unsaved, so a blur after Enter does not save twice.
 */
function AreaName({
  area,
  onSave,
  onError,
}: {
  area: Area;
  onSave: (name: string) => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(text: string) {
    const name = text.trim();
    setDraft(null);
    if (name === area.name) return;
    if (!name) {
      onError("An area needs a name, so the old one is back.");
      return;
    }
    onSave(name);
  }

  return (
    <input
      value={draft ?? area.name}
      aria-label={`Rename ${area.name}`}
      maxLength={AREA_NAME_MAX}
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
      className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[15px] text-ink hover:border-rule-soft focus:border-field focus:bg-sheet"
    />
  );
}

function AddArea({ onAdd, onError }: { onAdd: AreaActions["add"]; onError: (message: string | null) => void }) {
  const [value, setValue] = useState("");
  const [pending, startAdding] = useTransition();
  const fieldId = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    onError(null);
    startAdding(async () => {
      const result = await onAdd(name);
      if (result.ok) setValue("");
      else onError(result.error);
    });
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="flex max-w-[440px] gap-2">
      <label htmlFor={fieldId} className="sr-only">
        New area name
      </label>
      <input
        id={fieldId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={AREA_NAME_MAX}
        placeholder="New area, like Studio or Family"
        className="min-w-0 flex-1 rounded-lg border border-field bg-sheet px-3 py-2 text-ink"
      />
      <button
        type="submit"
        aria-disabled={pending || undefined}
        className="rounded-lg border border-rule px-3.5 py-2 font-medium text-ink hover:bg-accent-wash aria-disabled:opacity-60"
      >
        {pending ? "Adding" : "Add area"}
      </button>
    </form>
  );
}
