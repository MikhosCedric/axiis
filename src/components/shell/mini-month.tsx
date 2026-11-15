"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LocalDate } from "@/domain/item";
import { gridStep } from "@/features/month/grid-step";
import { addMonths, formatMonthHeading, monthGrid, monthOf, sameDayIn, type YearMonth } from "@/features/month/model";
import { formatDayIn } from "@/features/today/format";
import { weekdayName } from "@/features/week/model";
import { WEEK_LENGTH } from "@/features/week/week-of";
import { addDays, FIRST_DATE, LAST_DATE } from "@/lib/dates";
import { useWeekStart } from "./week-start-context";

const stepButton =
  "inline-flex size-7 flex-none items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-ink active:bg-press disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11";

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M11 4L6 9l5 5" : "M7 4l5 5-5 5"} />
    </svg>
  );
}

const inSpan = (date: LocalDate) => date >= FIRST_DATE && date <= LAST_DATE;

/**
 * A small month to jump by: the side panel's, the More sheet's and the one under a calendar view's
 * title. Each day is a link to `hrefFor(day)`. The days the page shows (`from` to `to`) sit on a
 * band of Press Tint, today is filled with Ink as the Month view fills it, and days of the
 * neighbouring months are quiet. One day takes Tab; arrows, Home, End, Page Up and Page Down move
 * between days as they do on the Month view, turning the month when they leave it.
 */
export function MiniMonth({
  today,
  anchor,
  from,
  to,
  hrefFor,
  onGo,
  autoFocus = false,
  className = "",
}: {
  today: LocalDate;
  /** The day the page is about: its month is shown first, and it is the day Tab lands on. */
  anchor: LocalDate;
  from: LocalDate | null;
  to: LocalDate | null;
  hrefFor: (date: LocalDate) => string;
  onGo?: () => void;
  /** Mark the anchor day for focus when a popover holding the month opens. */
  autoFocus?: boolean;
  className?: string;
}) {
  const id = useId();
  const startsOn = useWeekStart();
  const grid = useRef<HTMLDivElement>(null);
  const [was, setWas] = useState(anchor);
  const [month, setMonth] = useState<YearMonth>(monthOf(anchor));
  const [focused, setFocused] = useState(anchor);
  const moved = useRef(false);
  // The page moved on (a step, a pick, another view): the month follows it.
  if (was !== anchor) {
    setWas(anchor);
    setMonth(monthOf(anchor));
    setFocused(anchor);
  }

  // A keyboard move puts focus on the day it lands on, once that day is drawn.
  useLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  });

  const days = monthGrid(month, startsOn);
  const weeks = Array.from({ length: days.length / WEEK_LENGTH }, (_, w) => days.slice(w * WEEK_LENGTH, (w + 1) * WEEK_LENGTH));
  // The day Tab reaches: the focused one while it is drawn, or the first of the shown month.
  const tabStop = days.includes(focused) ? focused : (`${month}-01` as LocalDate);

  function turn(by: number) {
    const next = addMonths(month, by);
    setMonth(next);
    setFocused(sameDayIn(focused, by));
  }

  function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>, date: LocalDate, index: number) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = gridStep(e.key, index);
    if (!step) return;
    e.preventDefault();
    const next = "days" in step ? addDays(date, step.days) : sameDayIn(date, step.months);
    if (!inSpan(next)) return;
    moved.current = true;
    setFocused(next);
    if (monthOf(next) !== month && !days.includes(next)) setMonth(monthOf(next));
    else if ("months" in step) setMonth(monthOf(next));
  }

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);

  return (
    <div className={className}>
      <div className="flex items-center gap-0.5">
        <p id={id} aria-live="polite" className="min-w-0 flex-1 truncate pl-1.5 font-display text-[15px] leading-none font-medium">
          {formatMonthHeading(month)}
        </p>
        <button type="button" className={stepButton} disabled={month <= monthOf(FIRST_DATE)} onClick={() => turn(-1)} title={`Show ${formatMonthHeading(previous)}`}>
          <Chevron back />
          <span className="sr-only">Show {formatMonthHeading(previous)}</span>
        </button>
        <button type="button" className={stepButton} disabled={month >= monthOf(LAST_DATE)} onClick={() => turn(1)} title={`Show ${formatMonthHeading(next)}`}>
          <Chevron />
          <span className="sr-only">Show {formatMonthHeading(next)}</span>
        </button>
      </div>
      <div ref={grid} role="grid" aria-labelledby={id} className="mt-1.5 grid gap-y-0.5">
        <div role="row" className="grid grid-cols-7">
          {weeks[0].map((date) => (
            <span key={date} role="columnheader" aria-label={weekdayName(date, "long")} className="pb-1 text-center text-[11px] leading-none font-medium text-ink-3">
              {weekdayName(date, "short").slice(0, 2)}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={week[0]} role="row" className="grid grid-cols-7">
            {week.map((date, i) => {
              const isToday = date === today;
              const shown = from !== null && to !== null && date >= from && date <= to;
              const outside = monthOf(date) !== month;
              const ok = inSpan(date);
              // The band of days in view runs unbroken along a row and is rounded where it starts and ends.
              const starts = shown && (date === from || i === 0);
              const ends = shown && (date === to || i === WEEK_LENGTH - 1);
              return (
                <div
                  key={date}
                  role="gridcell"
                  aria-selected={shown}
                  className={`flex justify-center ${shown ? "bg-press" : ""} ${starts ? "rounded-l-full" : ""} ${ends ? "rounded-r-full" : ""}`}
                >
                  <Link
                    href={ok ? hrefFor(date) : "#"}
                    // A month of links would each fetch a page; a day is fetched when it is chosen.
                    prefetch={false}
                    data-date={date}
                    data-today={isToday || undefined}
                    data-autofocus={autoFocus && date === tabStop ? "" : undefined}
                    tabIndex={date === tabStop ? 0 : -1}
                    aria-current={isToday ? "date" : undefined}
                    aria-disabled={ok ? undefined : true}
                    aria-label={`${formatDayIn(date, today)}${isToday ? ", today" : ""}`}
                    onClick={(e) => {
                      if (!ok) return e.preventDefault();
                      setFocused(date);
                      onGo?.();
                    }}
                    onKeyDown={(e) => onKeyDown(e, date, w * WEEK_LENGTH + i)}
                    className={`inline-flex size-[26px] items-center justify-center rounded-full text-[12px] leading-none tabular pointer-coarse:size-10 pointer-coarse:text-[14px] ${
                      isToday
                        ? "bg-ink font-semibold text-paper"
                        : `${outside ? "text-ink-3" : shown ? "font-medium text-ink" : "text-ink-2"} hover:bg-hover hover:text-ink active:bg-press`
                    } ${ok ? "" : "pointer-events-none opacity-40"}`}
                  >
                    {Number(date.slice(-2))}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
