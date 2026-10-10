"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { LocalDate } from "@/domain/item";
import { planDate, type PlanFor } from "@/features/inbox/model";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";

const choice =
  "rounded-md border border-rule px-3 py-1.5 pointer-coarse:min-h-11 text-[13px] font-medium text-ink hover:bg-accent-wash aria-pressed:bg-accent-wash disabled:cursor-default disabled:opacity-60";

/**
 * The When row: where the item sits in time, and when `days` is on, a way to
 * put it on today, tomorrow or another day, or take it off its day. The choices
 * open under the row like the Inbox's "Plan for": the first takes focus, Escape
 * closes them, and focus goes back to the trigger once one is picked.
 */
export function PlanRow({
  label,
  when,
  day,
  today,
  days,
  unplan,
  trigger,
  onPlan,
  onUnplan,
}: {
  label: string;
  when: string;
  day: LocalDate | null;
  today: LocalDate;
  days: boolean;
  unplan: boolean;
  /** The sheet's handle on the trigger, so it can send focus here when the item needs a day. */
  trigger: RefObject<HTMLButtonElement | null>;
  onPlan: (when: PlanFor) => void;
  onUnplan: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dateId = useId();
  const first = useRef<HTMLButtonElement>(null);
  const [picked, setPicked] = useState("");
  const verb = day === null ? "Plan for" : "Move to";

  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function pick(when: PlanFor) {
    close();
    setPicked("");
    if (planDate(when, today) !== day) onPlan(when);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const on = parseLocalDate(picked);
    if (on) pick(on);
  }

  return (
    <>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
        <span className="tabular">{when}</span>
        {days && (
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
            className="rounded-md px-1.5 py-1 pointer-coarse:min-h-11 text-[13px] font-medium text-ink-2 hover:bg-accent-wash hover:text-ink"
          >
            {verb}
          </button>
        )}
        {days && open && (
          <div
            id={panelId}
            role="group"
            aria-label={verb}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            className="flex basis-full flex-wrap items-center gap-2"
          >
            <button ref={first} type="button" className={choice} aria-pressed={day === today} onClick={() => pick("today")}>
              Today
            </button>
            <button type="button" className={choice} aria-pressed={day === planDate("tomorrow", today)} onClick={() => pick("tomorrow")}>
              Tomorrow
            </button>
            {unplan && (
              <button
                type="button"
                className={choice}
                onClick={() => {
                  close();
                  onUnplan();
                }}
              >
                No day
              </button>
            )}
            <form onSubmit={submit} className="flex basis-full flex-wrap items-center gap-2">
              <label htmlFor={dateId} className="text-[13px] text-ink-2">
                Another day
              </label>
              <input
                id={dateId}
                type="date"
                required
                min={FIRST_DATE}
                max={LAST_DATE}
                value={picked}
                onChange={(e) => setPicked(e.currentTarget.value)}
                className="h-9 rounded-md border border-rule bg-sheet px-2.5 text-ink tabular"
              />
              <button type="submit" className={choice} disabled={!picked}>
                {day === null ? "Plan" : "Move"}
              </button>
            </form>
          </div>
        )}
      </dd>
    </>
  );
}
