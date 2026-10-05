"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import type { ItemType } from "@/domain/item";
import { setDoneAction } from "./actions";
import { Glyph } from "./glyph";
import type { BeamState } from "./model";

const TITLE_WEIGHT: Record<BeamState, string> = {
  planned: "font-medium text-ink",
  live: "font-bold text-ink",
  done: "font-normal text-ink-3",
};

export function ItemRow(props: {
  id: string;
  title: string;
  type: ItemType;
  state: BeamState;
  area: string | null;
  time?: ReactNode;
}) {
  const [done, setDone] = useOptimistic(props.state === "done");
  const [justDone, setJustDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const state: BeamState = done ? "done" : props.state === "done" ? "planned" : props.state;

  function toggle() {
    const next = !done;
    setJustDone(next);
    setError(null);
    startTransition(async () => {
      setDone(next);
      const result = await setDoneAction(props.id, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li
      className={`grid items-center gap-x-3 border-b border-rule-soft py-2.5 ${
        props.time === undefined ? "grid-cols-[48px_minmax(0,1fr)_auto]" : "grid-cols-[minmax(4.5rem,auto)_48px_minmax(0,1fr)_auto]"
      }`}
    >
      {props.time !== undefined && <span className="text-ink-2 tabular">{props.time}</span>}
      <label className="relative grid h-8 w-12 cursor-pointer place-items-center rounded-md hover:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        <input type="checkbox" className="sr-only" checked={done} onChange={toggle} aria-label={props.title} />
        <Glyph type={props.type} state={state} justDone={justDone && done} />
      </label>
      <span className={`min-w-0 break-words ${TITLE_WEIGHT[state]}`}>{props.title}</span>
      <span className="text-[13px] text-ink-3">
        {error ? (
          <span role="status" className="text-ink-2">
            {error}
          </span>
        ) : (
          props.area
        )}
      </span>
    </li>
  );
}
