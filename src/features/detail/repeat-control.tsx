"use client";

import { useEffect, useId, useOptimistic, useRef, useState } from "react";
import type { LocalDate } from "@/domain/item";
import { MAX_COUNT, MAX_INTERVAL, WEEKDAYS, sortWeekdays, type RuleEnd, type Weekday } from "@/domain/recurrence";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";
import type { RepeatView } from "./model";
import { RepeatIcon } from "./icons";
import { Row, editorField, rowButton } from "./rows";
import {
  DAY_NAME,
  PRESET_LABEL,
  REPEAT_FREQS,
  REPEAT_PRESETS,
  UNIT,
  monthlyChoices,
  weekdayOf,
  type CustomRepeat,
  type RepeatChoice,
  type RepeatPreset,
} from "./repeat";

const field = editorField;
const END_LABEL: Record<RuleEnd["kind"], string> = { never: "Never", until: "On a date", count: "After a number of times" };

type Menu = RepeatPreset | "custom";

/**
 * The Repeat row of the detail panel: a line that reads the rule in words
 * ("Does not repeat", "Every 3 weeks on Mon, Wed") and opens the editor under
 * it: the menu of usual choices, the editor
 * that "Custom…" opens (every N days, weeks, months or years, the weekdays of a
 * weekly one, where in the month a monthly one falls) and how it ends. Every
 * change goes to the whole series as it is made. `save` runs inside the sheet's
 * transition, so a field shows the new choice at once and goes back if the save
 * fails. `startOn` is the day something not yet repeating would start on.
 */
export function RepeatRows({
  repeat,
  startOn,
  save,
}: {
  repeat: Extract<RepeatView, { kind: "off" | "series" | "occurrence" }>;
  startOn: LocalDate;
  save: (choice: RepeatChoice, show: () => void) => void;
}) {
  const repeatId = useId();
  const everyId = useId();
  const onId = useId();
  const endId = useId();
  const firstOn = repeat.kind === "off" ? startOn : repeat.firstOn;
  const current: Menu = repeat.kind === "off" ? "none" : (repeat.preset ?? "custom");
  const stored: CustomRepeat =
    repeat.kind === "off" ? { freq: "weekly", interval: 1, byDay: [weekdayOf(firstOn)], onThe: null } : repeat.custom;
  const [preset, setPreset] = useOptimistic<Menu>(current);
  const [custom, setCustom] = useOptimistic<CustomRepeat>(stored);
  const [end, setEnd] = useOptimistic<RuleEnd>(repeat.kind === "off" ? { kind: "never" } : repeat.end);
  // The editor stays open once asked for, even while its fields happen to spell a choice the menu names.
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const asked = useRef(false);
  const editorId = useId();
  const [every, setEvery] = useState(String(custom.interval));
  const [count, setCount] = useState(end.kind === "count" ? String(end.count) : "10");

  const shown: Menu = editing && preset !== "none" ? "custom" : preset;
  const repeating = repeat.kind !== "off" && shown !== "none";

  useEffect(() => {
    if (open && asked.current) selectRef.current?.focus();
    asked.current = false;
  }, [open]);

  function choose(next: Menu) {
    if (next !== "custom") {
      setEditing(false);
      save({ preset: next, end: next === "none" ? { kind: "never" } : end }, () => setPreset(next));
      return;
    }
    setEditing(true);
    setEvery(String(custom.interval));
    // Something not yet repeating starts on the editor's first reading, as any other choice starts it.
    if (preset === "none") save({ preset: "custom", custom, end: { kind: "never" } }, () => setPreset("custom"));
  }

  function change(next: CustomRepeat) {
    setEditing(true);
    save({ preset: "custom", custom: next, end }, () => {
      setPreset("custom");
      setCustom(next);
    });
  }

  function changeEnd(next: RuleEnd) {
    if (shown === "none") return;
    save(shown === "custom" ? { preset: "custom", custom, end: next } : { preset: shown, end: next }, () => setEnd(next));
  }

  function endKind(kind: RuleEnd["kind"]) {
    if (repeat.kind === "off") return;
    if (kind === "never") changeEnd({ kind: "never" });
    if (kind === "until") changeEnd({ kind: "until", on: repeat.defaultUntil });
    if (kind === "count") changeEnd({ kind: "count", count: Number(count) || 10 });
  }

  function commitEvery() {
    const n = Math.round(Number(every));
    if (!Number.isFinite(n) || n < 1 || n > MAX_INTERVAL) {
      setEvery(String(custom.interval));
      return;
    }
    setEvery(String(n));
    if (n !== custom.interval) change({ ...custom, interval: n });
  }

  function commitCount() {
    const n = Math.round(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > MAX_COUNT) {
      setCount(end.kind === "count" ? String(end.count) : "10");
      return;
    }
    if (end.kind !== "count" || end.count !== n) changeEnd({ kind: "count", count: n });
  }

  function toggleDay(day: Weekday) {
    const on = custom.byDay.includes(day);
    // It has to fall on some day, so the last one stays.
    if (on && custom.byDay.length === 1) return;
    change({ ...custom, byDay: sortWeekdays(on ? custom.byDay.filter((d) => d !== day) : [...custom.byDay, day]) });
  }

  const many = (Number(every) || custom.interval) !== 1;
  const monthly = monthlyChoices(firstOn, custom.onThe);
  const monthlyValue = custom.onThe ? `${custom.onThe.nth}${custom.onThe.day}` : "day";


  const words = repeat.kind === "off" ? "Does not repeat" : repeat.summary;
  const label = "block w-[3.25rem] flex-none text-[13px] text-ink-2";
  const line = "flex flex-wrap items-center gap-x-2 gap-y-1";

  return (
    <div>
      <Row icon={<RepeatIcon />}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={editorId}
          aria-label={`Repeat: ${words}`}
          onClick={() => {
            asked.current = !open;
            setOpen(!open);
          }}
          className={`${rowButton} ${repeat.kind === "off" ? "text-ink-2" : ""}`}
        >
          <span className="min-w-0 flex-1">{words}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width={12}
            height={12}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`flex-none text-ink-3 ${open ? "rotate-180" : ""}`}
          >
            <path d="M4 6.5l4 4 4-4" />
          </svg>
        </button>
      </Row>

      {open && (
        <div id={editorId} className="grid gap-2 pt-1 pb-2 pl-7">
          <div className={line}>
            <label htmlFor={repeatId} className="sr-only">
              Repeat
            </label>
            <select ref={selectRef} id={repeatId} value={shown} onChange={(e) => choose(e.target.value as Menu)} className={field}>
              {REPEAT_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PRESET_LABEL[p]}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>

          {repeating && shown === "custom" && (
            <>
              <div className={line}>
                <label htmlFor={everyId} className={label}>
                  Every
                </label>
                <input
                  id={everyId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_INTERVAL}
                  value={every}
                  onChange={(e) => setEvery(e.target.value)}
                  onBlur={commitEvery}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEvery();
                  }}
                  className={`${field} w-[5.5ch] tabular`}
                />
                <select
                  aria-label="Days, weeks, months or years"
                  value={custom.freq}
                  onChange={(e) => change({ ...custom, freq: e.target.value as CustomRepeat["freq"], onThe: null })}
                  className={field}
                >
                  {REPEAT_FREQS.map((f) => (
                    <option key={f} value={f}>
                      {many ? `${UNIT[f]}s` : UNIT[f]}
                    </option>
                  ))}
                </select>
              </div>

              {custom.freq === "weekly" && (
                <div className="flex items-start gap-x-2">
                  <span id={onId} className={`${label} pt-1`}>
                    On
                  </span>
                  <div role="group" aria-labelledby={onId} className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const on = custom.byDay.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={on}
                          aria-disabled={on && custom.byDay.length === 1 ? true : undefined}
                          onClick={() => toggleDay(day)}
                          className="pill px-2.5 py-1"
                        >
                          <span aria-hidden="true">{DAY_NAME[day].slice(0, 3)}</span>
                          <span className="sr-only">{DAY_NAME[day]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {custom.freq === "monthly" && (
                <div className={line}>
                  <label htmlFor={onId} className={label}>
                    On
                  </label>
                  <select
                    id={onId}
                    value={monthlyValue}
                    onChange={(e) => change({ ...custom, onThe: monthly.find((m) => m.value === e.target.value)?.onThe ?? null })}
                    className={field}
                  >
                    {monthly.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {repeating && (
            <div className={line}>
              <label htmlFor={endId} className={label}>
                Ends
              </label>
              <select id={endId} value={end.kind} onChange={(e) => endKind(e.target.value as RuleEnd["kind"])} className={field}>
                {(Object.keys(END_LABEL) as RuleEnd["kind"][]).map((k) => (
                  <option key={k} value={k}>
                    {END_LABEL[k]}
                  </option>
                ))}
              </select>
              {end.kind === "until" && (
                <input
                  type="date"
                  aria-label="Last date it repeats"
                  min={FIRST_DATE}
                  max={LAST_DATE}
                  value={end.on}
                  onChange={(e) => {
                    const on = parseLocalDate(e.target.value);
                    if (on) changeEnd({ kind: "until", on: on as LocalDate });
                  }}
                  className={`${field} tabular`}
                />
              )}
              {end.kind === "count" && (
                <span className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_COUNT}
                    aria-label="Number of times"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    onBlur={commitCount}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitCount();
                    }}
                    className={`${field} w-[5.5ch] tabular`}
                  />
                  <span className="text-ink-2">times</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
