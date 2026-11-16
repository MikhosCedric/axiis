"use client";

import { useId, useOptimistic, useState } from "react";
import type { LocalDate } from "@/domain/item";
import { MAX_COUNT, MAX_INTERVAL, WEEKDAYS, sortWeekdays, type RuleEnd, type Weekday } from "@/domain/recurrence";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";
import type { RepeatView } from "./model";
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

const field =
  "-ml-2 max-w-full rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink hover:border-rule-soft focus:border-field focus:bg-sheet";
const END_LABEL: Record<RuleEnd["kind"], string> = { never: "Never", until: "On a date", count: "After a number of times" };

type Menu = RepeatPreset | "custom";

/**
 * The Repeat rows of the detail list: the menu of usual choices, the editor
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
  const [every, setEvery] = useState(String(custom.interval));
  const [count, setCount] = useState(end.kind === "count" ? String(end.count) : "10");

  const shown: Menu = editing && preset !== "none" ? "custom" : preset;
  const repeating = repeat.kind !== "off" && shown !== "none";

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

  return (
    <>
      <dt className="text-[13px] text-ink-3">
        <label htmlFor={repeatId}>Repeat</label>
      </dt>
      <dd>
        <select id={repeatId} value={shown} onChange={(e) => choose(e.target.value as Menu)} className={field}>
          {REPEAT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {repeating && <span className="block text-[13px] text-ink-2">{repeat.summary}</span>}
      </dd>

      {repeating && shown === "custom" && (
        <>
          <dt className="text-[13px] text-ink-3">
            <label htmlFor={everyId}>Every</label>
          </dt>
          <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
              className={`${field} ml-0`}
            >
              {REPEAT_FREQS.map((f) => (
                <option key={f} value={f}>
                  {many ? `${UNIT[f]}s` : UNIT[f]}
                </option>
              ))}
            </select>
          </dd>

          {custom.freq === "weekly" && (
            <>
              <dt id={onId} className="text-[13px] text-ink-3">
                On
              </dt>
              <dd>
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
              </dd>
            </>
          )}

          {custom.freq === "monthly" && (
            <>
              <dt className="text-[13px] text-ink-3">
                <label htmlFor={onId}>On</label>
              </dt>
              <dd>
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
              </dd>
            </>
          )}
        </>
      )}

      {repeating && (
        <>
          <dt className="text-[13px] text-ink-3">
            <label htmlFor={endId}>Ends</label>
          </dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                className={`${field} ml-0 tabular`}
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
                  className={`${field} ml-0 w-[5.5ch] tabular`}
                />
                <span className="text-ink-2">times</span>
              </span>
            )}
          </dd>
        </>
      )}
    </>
  );
}
