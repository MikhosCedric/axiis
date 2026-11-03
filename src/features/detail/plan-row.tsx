"use client";

import { useId, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Floating } from "@/components/floating";
import type { LocalDate } from "@/domain/item";
import { planDate, type PlanFor } from "@/features/inbox/model";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";

const choice =
  "inline-flex h-9 items-center justify-center rounded-full bg-hover px-3.5 text-[13px] font-medium text-ink hover:bg-press active:bg-press aria-pressed:bg-ink aria-pressed:text-paper disabled:cursor-default disabled:opacity-60 pointer-coarse:h-11";

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

  // Where the dropdown opens: under the trigger, measured once per opening so it is not placed again on every render.
  const at = useMemo(() => {
    const r = open ? trigger.current?.getBoundingClientRect() : null;
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  }, [open, trigger]);

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
            className="inline-flex items-center gap-1 rounded-full bg-hover py-1.5 pr-2 pl-3 text-[13px] font-medium text-ink-2 hover:bg-press hover:text-ink active:bg-press pointer-coarse:min-h-11"
          >
            {verb}
            <svg aria-hidden="true" viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-180" : ""}>
              <path d="M4 6.5l4 4 4-4" />
            </svg>
          </button>
        )}
        {days && open && at && (
          <Floating
            at={at}
            label={verb}
            role="group"
            onClosed={(refocus) => (refocus ? close() : setOpen(false))}
            className="w-[min(320px,calc(100vw-32px))] rounded-[14px]! p-2.5"
          >
            <div id={panelId}>
              <div data-roving className="grid grid-cols-3 gap-1.5">
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
              </div>
              <form onSubmit={submit} className="mt-2 flex h-9 items-center gap-1.5 rounded-full border border-rule bg-sheet pr-1 pl-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent pointer-coarse:h-11">
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
                  className="h-full min-w-0 flex-1 bg-transparent px-1 text-ink tabular outline-none"
                />
                <button
                  type="submit"
                  className="h-7 rounded-full bg-ink px-3 text-[13px] font-medium text-paper hover:opacity-90 disabled:cursor-default disabled:bg-hover disabled:text-ink-3 pointer-coarse:h-9"
                  disabled={!picked}
                >
                  {day === null ? "Plan" : "Move"}
                </button>
              </form>
            </div>
          </Floating>
        )}
      </dd>
    </>
  );
}
