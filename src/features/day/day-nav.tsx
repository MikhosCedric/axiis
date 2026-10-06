"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LocalDate } from "@/domain/item";
import { formatDayHeading } from "@/features/today/format";
import { weekHref } from "@/features/week/model";
import { SpanSwitch } from "@/features/week/span-switch";
import { parseLocalDate } from "@/lib/dates";
import { dayHref, isTypingTarget, navTarget, shortcutAction } from "./nav";
import type { DayViewMode } from "./types";

const step =
  "inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-rule px-3 font-medium text-ink hover:bg-paper-2";

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
    <nav aria-label="Day" className="mb-5 flex flex-wrap items-center gap-2">
      <SpanSwitch current="day" dayHref={dayHref(date, today, mode)} weekHref={weekHref(date, today)} />
      <Link href={dayHref(previous, today, mode)} className={step} aria-keyshortcuts="[" title="Previous day ( [ )">
        <Chevron back />
        <span aria-hidden="true">Previous</span>
        <span className="sr-only">Previous day, {formatDayHeading(previous)}</span>
      </Link>
      <Link href={dayHref(next, today, mode)} className={step} aria-keyshortcuts="]" title="Next day ( ] )">
        <span aria-hidden="true">Next</span>
        <Chevron />
        <span className="sr-only">Next day, {formatDayHeading(next)}</span>
      </Link>
      <DatePicker date={date} onPick={(picked) => router.push(dayHref(picked, today, mode))} />
      {date !== today && (
        <Link
          href={dayHref(today, today, mode)}
          aria-keyshortcuts="t"
          title="Back to today ( T )"
          className="inline-flex h-9 items-center rounded-md border border-rule px-3 font-medium text-ink hover:bg-paper-2"
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
        min="1000-01-01"
        max="9999-12-31"
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
        className="h-9 rounded-md border border-rule bg-sheet px-2.5 text-ink tabular"
      />
    </>
  );
}
