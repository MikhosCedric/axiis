"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LocalDate } from "@/domain/item";
import { formatDayHeading } from "@/features/today/format";
import { spanHrefs } from "@/features/week/span";
import { SpanSwitch } from "@/features/week/span-switch";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";
import { dayHref, isTypingTarget, navTarget, shortcutAction } from "./nav";
import type { DayViewMode } from "./types";

const step =
  "inline-flex h-9 min-w-11 pointer-coarse:h-11 flex-none items-center justify-center gap-1.5 rounded-md border border-rule px-3 font-medium text-ink hover:bg-hover active:bg-press";

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M11 4L6 9l5 5" : "M7 4l5 5-5 5"} />
    </svg>
  );
}

export function DayNav({ date, today, mode }: { date: LocalDate; today: LocalDate; mode: DayViewMode }) {
  const router = useRouter();
  const previous = navTarget("previous", date, today);
  const next = navTarget("next", date, today);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const action = shortcutAction({
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        isComposing: e.isComposing,
        defaultPrevented: e.defaultPrevented,
        typing: target !== null && isTypingTarget(target),
      });
      if (!action) return;
      const to = navTarget(action, date, today);
      if (to === date) return;
      e.preventDefault();
      router.push(dayHref(to, today, mode));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, date, today, mode]);

  return (
    <nav aria-label="Day" className="flex flex-wrap items-center gap-2">
      <SpanSwitch current="day" hrefs={spanHrefs(date, today, mode)} />
      {/* One pair, so Previous and Next never wrap apart. */}
      <span className="inline-flex flex-none">
        <Link href={dayHref(previous, today, mode)} className={`${step} rounded-r-none`} aria-keyshortcuts="[" title="Previous day ( [ )">
          <Chevron back />
          <span aria-hidden="true" className="max-rail:hidden">Previous</span>
          <span className="sr-only">Previous day, {formatDayHeading(previous)}</span>
        </Link>
        <Link href={dayHref(next, today, mode)} className={`${step} -ml-px rounded-l-none`} aria-keyshortcuts="]" title="Next day ( ] )">
          <span aria-hidden="true" className="max-rail:hidden">Next</span>
          <Chevron />
          <span className="sr-only">Next day, {formatDayHeading(next)}</span>
        </Link>
      </span>
      <DatePicker date={date} onPick={(picked) => router.push(dayHref(picked, today, mode))} />
      {date !== today && (
        <Link
          href={dayHref(today, today, mode)}
          aria-keyshortcuts="t"
          title="Back to today ( T )"
          className="inline-flex h-9 pointer-coarse:h-11 items-center rounded-md border border-rule px-3 font-medium text-ink hover:bg-hover active:bg-press"
        >
          Today
        </Link>
      )}
    </nav>
  );
}

/**
 * A pick from the calendar goes at once. Typed input waits for Enter or blur,
 * because every keystroke that completes a date fires `change` and would
 * otherwise navigate away mid-edit.
 */
function DatePicker({ date, onPick }: { date: LocalDate; onPick: (date: LocalDate) => void }) {
  const [value, setValue] = useState<string>(date);
  const [shown, setShown] = useState(date);
  const typed = useRef(false);
  if (shown !== date) {
    setShown(date);
    setValue(date);
  }

  function commit(raw: string, input: HTMLInputElement) {
    const picked = parseLocalDate(raw);
    if (picked && picked !== date && input.validity.valid) onPick(picked);
  }

  return (
    <>
      <label htmlFor="day-picker" className="sr-only">
        Go to date
      </label>
      <input
        id="day-picker"
        type="date"
        required
        min={FIRST_DATE}
        max={LAST_DATE}
        value={value}
        onPointerDown={() => (typed.current = false)}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") commit(e.currentTarget.value, e.currentTarget);
          else typed.current = true;
        }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setValue(e.currentTarget.value);
          if (!typed.current) commit(e.currentTarget.value, e.currentTarget);
        }}
        onBlur={(e) => {
          if (typed.current) commit(e.currentTarget.value, e.currentTarget);
          typed.current = false;
        }}
        className="h-9 pointer-coarse:h-11 rounded-md border border-rule bg-sheet px-2.5 text-ink tabular"
      />
    </>
  );
}
