"use client";

import { useId, useState, type FocusEvent } from "react";
import type { LocalDate } from "@/domain/item";
import { parseLocalDate } from "@/lib/dates";
import { clockOf, timeFrom, type TimeOfDay } from "./model";

const field =
  "rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink tabular hover:border-rule-soft focus:border-field focus:bg-sheet";

/**
 * The Time row for an occurrence: a start and an end, saved when focus leaves
 * the pair or on Enter, and a way back to any time. Where the change goes
 * (this one or all of them) is the sheet's scope.
 */
export function TimeRow({
  time,
  save,
  clear,
}: {
  time: TimeOfDay | null;
  save: (time: TimeOfDay) => void;
  clear: () => void;
}) {
  const labelId = useId();
  const [start, setStart] = useState(time ? clockOf(time.start) : "");
  const [end, setEnd] = useState(time ? clockOf(time.start + time.length) : "");
  const [timed, setTimed] = useState(time !== null);

  function commit() {
    const next = timeFrom(start, end);
    if (!next) return;
    setEnd(clockOf(next.start + next.length));
    setTimed(true);
    if (time?.start !== next.start || time.length !== next.length) save(next);
  }

  function leave(e: FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) commit();
  }

  function anyTime() {
    setStart("");
    setEnd("");
    setTimed(false);
    clear();
  }

  return (
    <>
      <dt id={labelId} className="text-[13px] text-ink-3">
        Time
      </dt>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
        {timed ? (
          <button
            type="button"
            onClick={anyTime}
            className="rounded-md px-1.5 py-1 text-[13px] text-ink-2 hover:bg-accent-wash hover:text-ink"
          >
            Any time
          </button>
        ) : (
          <span className="text-[13px] text-ink-3">Any time</span>
        )}
      </dd>
    </>
  );
}

/** The first date of a series, saved when focus leaves the field or on Enter, never part way through typing a year. */
export function FirstDayRow({ firstOn, save }: { firstOn: LocalDate; save: (on: LocalDate) => void }) {
  const id = useId();
  const [value, setValue] = useState<string>(firstOn);
  const [saved, setSaved] = useState(firstOn);

  function commit() {
    const on = parseLocalDate(value);
    if (!on) return setValue(saved);
    if (on === saved) return;
    setSaved(on);
    save(on);
  }

  return (
    <>
      <dt className="text-[13px] text-ink-3">
        <label htmlFor={id}>First day</label>
      </dt>
      <dd>
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          className={`-ml-2 ${field}`}
        />
      </dd>
    </>
  );
}
