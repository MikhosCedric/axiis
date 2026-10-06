"use client";

import { useId, useState, type FocusEvent } from "react";
import { clockOf, timeFrom, type TimeOfDay } from "./model";

const field =
  "rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink tabular hover:border-rule-soft focus:border-field focus:bg-sheet";

/**
 * The Time row for an occurrence: a start and an end, saved when focus leaves
 * the pair or on Enter. Where the change goes (this one or all of them) is the
 * sheet's scope.
 */
export function TimeRow({ time, save }: { time: TimeOfDay | null; save: (time: TimeOfDay) => void }) {
  const labelId = useId();
  const [start, setStart] = useState(time ? clockOf(time.start) : "");
  const [end, setEnd] = useState(time ? clockOf(time.start + time.length) : "");

  function commit() {
    const next = timeFrom(start, end);
    if (!next) return;
    setEnd(clockOf(next.start + next.length));
    if (time?.start !== next.start || time.length !== next.length) save(next);
  }

  function leave(e: FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) commit();
  }

  return (
    <>
      <dt id={labelId} className="text-[13px] text-ink-3">
        Time
      </dt>
      <dd>
        <span
          role="group"
          aria-labelledby={labelId}
          className="-ml-2 flex flex-wrap items-center gap-x-1.5"
          onBlur={leave}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        >
          <input type="time" aria-label="Starts at" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          <span className="text-ink-2">to</span>
          <input type="time" aria-label="Ends at" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
        </span>
      </dd>
    </>
  );
}
