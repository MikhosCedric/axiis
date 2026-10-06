"use client";

import { useId, useOptimistic, useState } from "react";
import type { LocalDate } from "@/domain/item";
import { MAX_COUNT, type RuleEnd } from "@/domain/recurrence";
import { parseLocalDate } from "@/lib/dates";
import type { RepeatView } from "./model";
import { PRESET_LABEL, REPEAT_PRESETS, type RepeatChoice, type RepeatPreset } from "./repeat";

const field =
  "-ml-2 max-w-full rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink hover:border-rule-soft focus:border-field focus:bg-sheet";
const END_LABEL: Record<RuleEnd["kind"], string> = { never: "Never", until: "On a date", count: "After a number of times" };

/**
 * The Repeat and Ends rows of the detail list. Every change goes to the whole
 * series. `save` runs inside the sheet's transition, so the select shows the new
 * choice at once and goes back if the save fails.
 */
export function RepeatRows({
  repeat,
  save,
}: {
  repeat: Extract<RepeatView, { kind: "off" | "series" | "occurrence" }>;
  save: (choice: RepeatChoice, show: () => void) => void;
}) {
  const repeatId = useId();
  const endId = useId();
  const current = repeat.kind === "off" ? "none" : (repeat.preset ?? "custom");
  const [preset, setPreset] = useOptimistic<RepeatPreset | "custom">(current);
  const [end, setEnd] = useOptimistic<RuleEnd>(repeat.kind === "off" ? { kind: "never" } : repeat.end);
  const [count, setCount] = useState(end.kind === "count" ? String(end.count) : "10");

  function choose(next: RepeatPreset) {
    save({ preset: next, end: next === "none" ? { kind: "never" } : end }, () => setPreset(next));
  }

  function changeEnd(next: RuleEnd) {
    if (preset === "none" || preset === "custom") return;
    const p = preset;
    save({ preset: p, end: next }, () => setEnd(next));
  }

  function endKind(kind: RuleEnd["kind"]) {
    if (repeat.kind === "off") return;
    if (kind === "never") changeEnd({ kind: "never" });
    if (kind === "until") changeEnd({ kind: "until", on: repeat.defaultUntil });
    if (kind === "count") changeEnd({ kind: "count", count: Number(count) || 10 });
  }

  function commitCount() {
    const n = Math.round(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > MAX_COUNT) {
      setCount(end.kind === "count" ? String(end.count) : "10");
      return;
    }
    if (end.kind !== "count" || end.count !== n) changeEnd({ kind: "count", count: n });
  }

  const repeating = repeat.kind !== "off" && preset !== "none";

  return (
    <>
      <dt className="text-[13px] text-ink-3">
        <label htmlFor={repeatId}>Repeat</label>
      </dt>
      <dd>
        <select id={repeatId} value={preset} onChange={(e) => choose(e.target.value as RepeatPreset)} className={field}>
          {REPEAT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
          {preset === "custom" && repeat.kind !== "off" && (
            <option value="custom" disabled>
              Custom
            </option>
          )}
        </select>
        {repeating && <span className="block text-[13px] text-ink-2">{repeat.summary}</span>}
      </dd>

      {repeating && preset !== "custom" && (
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
