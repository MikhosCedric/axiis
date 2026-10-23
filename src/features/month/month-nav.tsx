"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { LocalDate } from "@/domain/item";
import { isTypingTarget, shortcutAction } from "@/features/day/nav";
import { spanHrefs } from "@/features/week/span";
import { SpanSwitch } from "@/features/week/span-switch";
import { MonthPicker } from "./month-picker";
import { anchorOf, formatMonthHeading, monthHref, monthNavTarget, monthOf, type YearMonth } from "./model";

const step =
  "inline-flex h-9 min-w-11 pointer-coarse:h-11 flex-none items-center justify-center gap-1.5 rounded-md border border-rule px-3 font-medium text-ink hover:bg-hover active:bg-press";

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M11 4L6 9l5 5" : "M7 4l5 5-5 5"} />
    </svg>
  );
}

/** A neighbour month's link. It fetches that month only once a pointer rests on it or focus reaches it. */
function StepLink({ href, className, children, ...rest }: { href: string; className: string; children: ReactNode; "aria-keyshortcuts": string; title: string }) {
  const [warm, setWarm] = useState(false);
  return (
    <Link
      href={href}
      prefetch={warm}
      onPointerEnter={() => setWarm(true)}
      onFocus={() => setWarm(true)}
      className={className}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function MonthNav({ month, today }: { month: YearMonth; today: LocalDate }) {
  const router = useRouter();
  const previous = monthNavTarget("previous", month, today);
  const next = monthNavTarget("next", month, today);
  const isThisMonth = month === monthOf(today);

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
      const to = monthNavTarget(action, month, today);
      if (to === month) return;
      e.preventDefault();
      router.push(monthHref(to, today));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, month, today]);

  return (
    <nav aria-label="Month" className="flex flex-wrap items-center gap-2">
      <SpanSwitch current="month" hrefs={spanHrefs(anchorOf(month, today), today)} />
      {/* One pair, so Previous and Next never wrap apart. */}
      <span className="inline-flex flex-none">
        <StepLink href={monthHref(previous, today)} className={`${step} rounded-r-none`} aria-keyshortcuts="[" title="Previous month ( [ )">
          <Chevron back />
          <span aria-hidden="true" className="max-rail:hidden">Previous</span>
          <span className="sr-only">Previous month, {formatMonthHeading(previous)}</span>
        </StepLink>
        <StepLink href={monthHref(next, today)} className={`${step} -ml-px rounded-l-none`} aria-keyshortcuts="]" title="Next month ( ] )">
          <span aria-hidden="true" className="max-rail:hidden">Next</span>
          <Chevron />
          <span className="sr-only">Next month, {formatMonthHeading(next)}</span>
        </StepLink>
      </span>
      <MonthPicker month={month} today={today} className={step} />
      {!isThisMonth && (
        <Link href={monthHref(monthOf(today), today)} aria-keyshortcuts="t" title="Back to this month ( T )" className={step}>
          This month
        </Link>
      )}
    </nav>
  );
}
