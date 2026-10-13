"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LocalDate } from "@/domain/item";
import { dayHref, isTypingTarget, shortcutAction } from "@/features/day/nav";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";
import { anchorDay, formatWeekHeading, weekHref, weekNavTarget, weekOf } from "./model";
import { SpanSwitch } from "./span-switch";

const step =
  "inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-rule px-3 font-medium text-ink hover:bg-paper-2";

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M11 4L6 9l5 5" : "M7 4l5 5-5 5"} />
    </svg>
  );
}

export function WeekNav({ days, today }: { days: LocalDate[]; today: LocalDate }) {
  const router = useRouter();
  const start = days[0];
  const previous = weekNavTarget("previous", start, today);
  const next = weekNavTarget("next", start, today);
  const isThisWeek = days.includes(today);

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
      const to = weekNavTarget(action, start, today);
      if (weekOf(to)[0] === start) return;
      e.preventDefault();
      router.push(weekHref(to, today));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, start, today]);

  return (
    <nav aria-label="Week" className="mb-5 flex flex-wrap items-center gap-2">
      <SpanSwitch current="week" dayHref={dayHref(anchorDay(days, today), today, "score")} weekHref={weekHref(start, today)} />
      <Link href={weekHref(previous, today)} className={step} aria-keyshortcuts="[" title="Previous week ( [ )">
        <Chevron back />
        <span aria-hidden="true">Previous</span>
        <span className="sr-only">Previous week, {formatWeekHeading(weekOf(previous))}</span>
      </Link>
      <Link href={weekHref(next, today)} className={step} aria-keyshortcuts="]" title="Next week ( ] )">
        <span aria-hidden="true">Next</span>
        <Chevron />
        <span className="sr-only">Next week, {formatWeekHeading(weekOf(next))}</span>
      </Link>
      <WeekPicker start={start} onPick={(picked) => router.push(weekHref(picked, today))} />
      {!isThisWeek && (
        <Link href="/week" aria-keyshortcuts="t" title="Back to this week ( T )" className={step}>
          This week
        </Link>
      )}
    </nav>
  );
}

/**
 * A pick from the calendar goes at once. Typed input waits for Enter or blur,
 * because every keystroke that completes a date fires `change`.
 */
function WeekPicker({ start, onPick }: { start: LocalDate; onPick: (date: LocalDate) => void }) {
  const [value, setValue] = useState<string>(start);
  const [shown, setShown] = useState(start);
  const typed = useRef(false);
  if (shown !== start) {
    setShown(start);
    setValue(start);
  }

  function commit(raw: string, input: HTMLInputElement) {
    const picked = parseLocalDate(raw);
    if (picked && weekOf(picked)[0] !== start && input.validity.valid) onPick(picked);
  }

  return (
    <>
      <label htmlFor="week-picker" className="sr-only">
        Go to the week of a date
      </label>
      <input
        id="week-picker"
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
        className="h-9 rounded-md border border-rule bg-sheet px-2.5 text-ink tabular focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
      />
    </>
  );
}
