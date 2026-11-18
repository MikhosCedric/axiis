"use client";

import { useCallback, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { Floating } from "@/components/floating";
import type { Box } from "@/lib/placement";
import type { LocalDate } from "@/domain/item";
import { planDate, type PlanFor } from "@/features/inbox/model";
import { CalendarIcon } from "./icons";
import { Row, rowButton } from "./rows";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";

const choice =
  "pill h-9 px-3.5";

/**
 * The date row: the day the item sits on, which is also the way to move it.
 * When `days` is on, it opens today, tomorrow, another day, or no day, under the
 * row like the Inbox's "Plan for": the first takes focus, Escape closes them,
 * and focus goes back to the trigger once one is picked.
 */
export function PlanRow({
  label,
  short,
  day,
  today,
  days,
  unplan,
  trigger,
  onPlan,
  onUnplan,
}: {
  label: string;
  /** The day in a few characters ("Wed 7 Oct"), or "No day". */
  short: string;
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

  // Where the dropdown opens: under the trigger, measured as it opens.
  const at = useCallback((): Box => {
    const r = trigger.current?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: 0, height: 0 };
  }, [trigger]);

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
    <Row icon={<CalendarIcon />}>
      {days ? (
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${label}: ${short}`}
          onClick={() => setOpen(!open)}
          className={`${rowButton} tabular ${day === null ? "text-ink-2" : ""}`}
        >
          {short}
        </button>
      ) : (
        <span className="tabular">{short}</span>
      )}
        {days && open && (
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
    </Row>
  );
}
