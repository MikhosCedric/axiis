"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type RefObject } from "react";
import type { LocalDate } from "@/domain/item";
import { DATE_RANGE_ERROR, FIRST_DATE, LAST_DATE, outOfRange, parseLocalDate } from "@/lib/dates";
import { useClock } from "@/components/shell/clock-context";
import { formatMinutes } from "@/lib/clock";
import { timeFrom, type TimeOfDay } from "./model";
import { CalendarIcon, ClockIcon, CloseIcon, DueIcon } from "./icons";
import { Row, smallField } from "./rows";

/**
 * The time row: a start and an end on one line, saved when focus leaves the
 * pair or on Enter, and an Any time switch that takes the time away. With no
 * time the fields stay out of the way until the switch is turned off. Where the
 * change goes (this one or all of them) is the sheet's scope.
 */
export function TimeRow({
  time,
  save,
  clear,
  startRef,
  needed = false,
}: {
  time: TimeOfDay | null;
  save: (time: TimeOfDay) => void;
  clear: () => void;
  /** The sheet's handle on the start field, so it can send focus here when the item needs a time. */
  startRef?: RefObject<HTMLInputElement | null>;
  /** The item needs a time (an event just made), so the fields are out even with none set. */
  needed?: boolean;
}) {
  const hintId = useId();
  const clock = useClock();
  const [start, setStart] = useState(time ? formatMinutes(time.start, clock) : "");
  const [end, setEnd] = useState(time ? formatMinutes(time.start + time.length, clock) : "");
  const [timed, setTimed] = useState(time !== null);
  const [adding, setAdding] = useState(false);
  const [unread, setUnread] = useState(false);
  const inner = useRef<HTMLInputElement>(null);
  const first = startRef ?? inner;
  const asked = useRef(false);
  const shown = timed || adding || needed;

  useEffect(() => {
    if (!adding || !asked.current) return;
    asked.current = false;
    first.current?.focus();
  }, [adding, first]);

  function commit() {
    const next = timeFrom(start, end);
    setUnread(next === null && (start.trim() !== "" || end.trim() !== ""));
    if (!next) return;
    setStart(formatMinutes(next.start, clock));
    setEnd(formatMinutes(next.start + next.length, clock));
    setTimed(true);
    if (time?.start !== next.start || time.length !== next.length) save(next);
  }

  function clockField(label: string, value: string, set: (value: string) => void, ref?: RefObject<HTMLInputElement | null>) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode={clock === "24" ? "numeric" : "text"}
        autoComplete="off"
        placeholder={clock === "24" ? "hh:mm" : "h:mm am"}
        aria-label={label}
        aria-describedby={hintId}
        aria-invalid={unread || undefined}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={`${smallField} ${clock === "24" ? "w-[7ch]" : "w-[10ch]"} text-center`}
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
    setAdding(false);
    setUnread(false);
    clear();
  }

  function toggle() {
    if (!shown) {
      asked.current = true;
      setAdding(true);
    } else if (timed) anyTime();
    else setAdding(false);
  }

  return (
    <Row icon={<ClockIcon />}>
      <div role="group" aria-label="Time" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {shown && (
          <span
            className="-ml-1 inline-flex items-center gap-1.5"
            onBlur={leave}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
          >
            {clockField("Starts at", start, setStart, first)}
            <span aria-hidden="true" className="text-ink-3">
              –
            </span>
            {clockField("Ends at", end, setEnd)}
          </span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={!shown}
          onClick={toggle}
          className={`inline-flex min-h-8 items-center gap-2 rounded-md px-1 text-[13px] text-ink-2 hover:text-ink pointer-coarse:min-h-11 ${shown ? "ml-auto" : "-ml-1"}`}
        >
          Any time
          <span
            aria-hidden="true"
            className={`relative h-4 w-7 flex-none rounded-full border transition-colors ${shown ? "border-rule bg-transparent" : "border-ink bg-ink"}`}
          >
            <span
              className={`absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-[left] ${shown ? "left-0.5 bg-ink-3" : "left-[calc(100%-0.75rem)] bg-paper"}`}
            />
          </span>
        </button>
        <p id={hintId} aria-live="polite" className={unread ? "basis-full text-[13px] font-medium text-ink" : "sr-only"}>
          {unread ? "That time could not be read. " : ""}
          {clock === "24" ? "24-hour clock, like 14:30 or 1430. 2:30pm works too." : "Like 2:30 PM, 2:30pm or 14:30."}
        </p>
      </div>
    </Row>
  );
}

/**
 * A date row, such as a series' First day or a Due date, saved when focus
 * leaves the field or on Enter, never part way through typing a year. With
 * `clear`, a set date can be taken away.
 */
export function DateRow({
  label,
  kind,
  on: initial,
  save,
  clear,
  picks,
  autoFocus = false,
}: {
  label: string;
  kind: "day" | "due";
  on: LocalDate | null;
  save: (on: LocalDate) => void;
  clear?: { label: string; run: () => void };
  /** One-tap dates shown under the field, such as Today and Tomorrow. */
  picks?: { label: string; on: LocalDate }[];
  autoFocus?: boolean;
}) {
  const id = useId();
  const hintId = useId();
  const [value, setValue] = useState<string>(initial ?? "");
  const [saved, setSaved] = useState(initial);
  const [far, setFar] = useState(false);

  function commit() {
    const on = parseLocalDate(value);
    setFar(outOfRange(value));
    if (!on) return setValue(saved ?? "");
    if (on === saved) return;
    setSaved(on);
    save(on);
  }

  function pick(on: LocalDate) {
    setValue(on);
    setFar(false);
    if (on === saved) return;
    setSaved(on);
    save(on);
  }

  function remove() {
    setValue("");
    setSaved(null);
    clear?.run();
  }

  return (
    <Row icon={kind === "due" ? <DueIcon /> : <CalendarIcon />}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="text-[13px] text-ink-2">
          {label}
        </label>
        <input
          id={id}
          type="date"
          min={FIRST_DATE}
          max={LAST_DATE}
          autoFocus={autoFocus}
          aria-describedby={hintId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          className={smallField}
        />
        {clear && saved !== null && (
          <button
            type="button"
            aria-label={clear.label}
            title={clear.label}
            onClick={remove}
            className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover active:bg-press hover:text-ink pointer-coarse:size-11"
          >
            <CloseIcon />
          </button>
        )}
        {picks && (
          <span className="flex basis-full flex-wrap gap-1.5">
            {picks.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={saved === p.on}
                onClick={() => pick(p.on)}
                className="pill px-2.5 py-0.5 text-[13px]"
              >
                {p.label}
              </button>
            ))}
          </span>
        )}
        <p id={hintId} aria-live="polite" className={far ? "basis-full text-[13px] font-medium text-ink" : "sr-only"}>
          {far ? DATE_RANGE_ERROR : ""}
        </p>
      </div>
    </Row>
  );
}
