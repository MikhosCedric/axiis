"use client";

import { ViewTransition } from "react";
import type { Area, ShownItem } from "@/domain/item";
import { formatClock } from "@/features/today/format";
import { Glyph } from "@/features/today/glyph";
import type { BeamState, TodayEntry, TodayView } from "@/features/today/model";
import type { ChildCount } from "@/lib/items/repo";

const TITLE_WEIGHT: Record<BeamState, string> = {
  planned: "font-medium text-ink",
  live: "font-bold text-ink",
  done: "font-normal text-ink-3",
};

export function ListView({
  view,
  areas,
  timeZone,
  childCounts,
  selectedId,
  justDone,
  onSelect,
  onToggleDone,
}: {
  view: TodayView;
  areas: Area[];
  timeZone: string;
  childCounts: Record<string, ChildCount>;
  selectedId: string | null;
  justDone: string | null;
  onSelect: (id: string | null) => void;
  onToggleDone: (item: ShownItem) => void;
}) {
  const areaName = new Map<string, string>(areas.map((a) => [a.id, a.name]));
  const row = ({ item, state }: TodayEntry) => {
    const count = childCounts[item.id];
    const s = item.schedule;
    const selected = selectedId === item.id;
    return (
      <li
        key={item.id}
        className={`grid grid-cols-[4.5rem_48px_minmax(0,1fr)] items-center gap-x-3 border-b border-rule-soft py-2.5 rail:grid-cols-[minmax(6.5rem,auto)_48px_minmax(0,1fr)_auto] ${
          selected ? "bg-accent-wash" : ""
        }`}
      >
        <span className="pl-1 text-ink-2 tabular">
          {s.kind === "timed" ? (
            <>
              <time dateTime={s.start.toISOString()}>{formatClock(s.start, timeZone)}</time>
              <span className="max-rail:hidden">
                {" to "}
                <time dateTime={s.end.toISOString()}>{formatClock(s.end, timeZone)}</time>
              </span>
            </>
          ) : (
            <span className="text-ink-3">{s.kind === "day" ? "Any time" : "Waiting"}</span>
          )}
        </span>
        <label className="relative grid h-8 w-12 cursor-pointer place-items-center rounded-md hover:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <input
            type="checkbox"
            className="sr-only"
            checked={state === "done"}
            onChange={() => onToggleDone(item)}
            aria-label={`Done: ${item.title}`}
          />
          <ViewTransition name={`item-${item.id}`} share="morph" default="none">
            <Glyph type={item.type} state={state} justDone={justDone === item.id} />
          </ViewTransition>
        </label>
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(item.id)}
          className={`min-w-0 cursor-pointer rounded text-left break-words hover:underline ${TITLE_WEIGHT[state]}`}
        >
          {item.title}
          {count && (
            <span className="ml-1.5 font-normal text-ink-2 tabular">
              <span aria-hidden="true">
                {count.done}/{count.total}
              </span>
              <span className="sr-only">
                , {count.done} of {count.total} subtasks done
              </span>
            </span>
          )}
        </button>
        <span className="pr-1 text-[13px] text-ink-3 max-rail:hidden">
          {item.areaId ? (areaName.get(item.areaId) ?? "") : ""}
        </span>
      </li>
    );
  };

  return (
    <section aria-labelledby="list-h">
      <h2 id="list-h" className="sr-only">
        List
      </h2>
      <h3 className="border-b border-rule pb-2.5 font-serif text-lg font-medium">Planned</h3>
      {view.scheduled.length ? (
        <ul>{view.scheduled.map(row)}</ul>
      ) : (
        <p className="py-3 text-ink-2">Nothing has a time yet.</p>
      )}
      <h3 className="mt-10 font-serif text-lg font-medium">Waiting for a time</h3>
      <p className="mt-1 border-b border-rule pb-2.5 text-[13px] text-ink-2">
        Captured and safe. Give these a time when you are ready.
      </p>
      {view.waiting.length ? (
        <ul>{view.waiting.map(row)}</ul>
      ) : (
        <p className="py-3 text-ink-2">Everything has a time. Capture something new above.</p>
      )}
    </section>
  );
}
