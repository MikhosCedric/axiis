"use client";

import { useId, useState, type FocusEvent, type RefObject } from "react";
import type { LocalDate } from "@/domain/item";
import { parseLocalDate } from "@/lib/dates";
import { clockOf, timeFrom, type TimeOfDay } from "./model";

const field =
  "rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink tabular hover:border-rule-soft focus:border-field focus:bg-sheet";

/**
 * The Time row: a start and an end, saved when focus leaves
 * the pair or on Enter, and a way back to any time. Where the change goes
 * (this one or all of them) is the sheet's scope.
 */
export function TimeRow({
  time,
  save,
  clear,
  startRef,
}: {
  time: TimeOfDay | null;
  save: (time: TimeOfDay) => void;
  clear: () => void;
  /** The sheet's handle on the start field, so it can send focus here when the item needs a time. */
  startRef?: RefObject<HTMLInputElement | null>;
}) {
  const labelId = useId();
  const hintId = useId();
  const [start, setStart] = useState(time ? clockOf(time.start) : "");
  const [end, setEnd] = useState(time ? clockOf(time.start + time.length) : "");
  const [timed, setTimed] = useState(time !== null);
  const [unread, setUnread] = useState(false);

  function commit() {
    const next = timeFrom(start, end);
    setUnread(next === null && (start.trim() !== "" || end.trim() !== ""));
    if (!next) return;
    setStart(clockOf(next.start));
    setEnd(clockOf(next.start + next.length));
    setTimed(true);
    if (time?.start !== next.start || time.length !== next.length) save(next);
  }

  function clockField(label: string, value: string, set: (value: string) => void, ref?: RefObject<HTMLInputElement | null>) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        aria-label={label}
        aria-describedby={hintId}
        aria-invalid={unread || undefined}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={`${field} w-[7ch] text-center`}
      />
    );
  }

  function leave(e: FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) commit();
  }

  function anyTime() {
    setStart("");
    setEnd("");
    setTimed(false);
    setUnread(false);
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
          {clockField("Starts at", start, setStart, startRef)}
          <span className="text-ink-2">to</span>
          {clockField("Ends at", end, setEnd)}
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
        <p id={hintId} aria-live="polite" className={unread ? "basis-full text-[13px] font-medium text-ink" : "sr-only"}>
          {unread ? "That time could not be read. " : ""}24-hour clock, like 14:30 or 1430.
        </p>
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
