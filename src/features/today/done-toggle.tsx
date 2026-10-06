"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { ItemType } from "@/domain/item";
import type { ActionResult } from "./commands";
import { Glyph } from "./glyph";

export type SetDone = (id: string, done: boolean) => Promise<ActionResult>;

/** A row's glyph as its done box: ticking it marks the item done, the glyph turning hollow. */
export function DoneToggle({
  type,
  title,
  done,
  justDone,
  onToggle,
}: {
  type: ItemType;
  title: string;
  done: boolean;
  justDone: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="relative grid h-8 w-12 cursor-pointer place-items-center rounded-md hover:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input type="checkbox" className="sr-only" checked={done} onChange={onToggle} aria-label={`Done: ${title}`} />
      <Glyph type={type} state={done ? "done" : "planned"} justDone={justDone} />
    </label>
  );
}

/** Done ticks for a list whose rows come from the server: each reads as ticked at once, and says how the save went. */
export function useDoneToggles(setDone: SetDone) {
  const [, startTransition] = useTransition();
  const [ticked, tick] = useOptimistic(new Map<string, boolean>(), (now, [id, done]: [string, boolean]) =>
    new Map(now).set(id, done),
  );
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

  function toggle(id: string, title: string, done: boolean) {
    setStatus(null);
    setJustDone(done ? id : null);
    startTransition(async () => {
      tick([id, done]);
      const result = await setDone(id, done);
      setStatus(
        result.ok
          ? { text: done ? `${title} is done.` : `${title} is open again.`, error: false }
          : { text: result.error, error: true },
      );
    });
  }

  return { isDone: (id: string, saved: boolean) => ticked.get(id) ?? saved, toggle, status, justDone };
}
