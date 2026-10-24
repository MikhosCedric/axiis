"use client";

import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LocalDate } from "@/domain/item";
import { FIRST_DATE, LAST_DATE } from "@/lib/dates";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { monthHref, monthOf, pickerStep, stepYear, type YearMonth } from "./model";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GUTTER = 16;
const GAP = 6;

const yearStep =
  "inline-flex size-9 pointer-coarse:size-11 items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-ink active:bg-press disabled:pointer-events-none disabled:opacity-40";

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M11 4L6 9l5 5" : "M7 4l5 5-5 5"} />
    </svg>
  );
}

/**
 * Jump to month: a native popover under its button, with a year stepper over
 * the year's months in rows of three. Arrows move between months and across
 * years, Page Up and Page Down by a year, Enter goes. The month on screen is
 * filled with Ink, and this month has an Ink tick, as the grid marks today in
 * Ink. Escape and a click outside close it, and focus goes back to the button.
 */
export function MonthPicker({ month, today, className }: { month: YearMonth; today: LocalDate; className: string }) {
  const id = useId();
  const router = useRouter();
  const keep = useKeepFilter();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(month);
  const moved = useRef(false);
  const year = focused.slice(0, 4);
  const thisMonth = monthOf(today);

  // Keyboard moves put focus on the month they land on, once it is drawn.
  useLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    panel.current?.querySelector<HTMLElement>(`[data-month="${focused}"]`)?.focus();
  });

  // The shown month carries autofocus, so the popover focuses it as it opens, before the next key. The toggle
  // event comes later, as a task of its own, and an arrow pressed at once would otherwise land on the button.
  useLayoutEffect(() => {
    for (const el of panel.current?.querySelectorAll<HTMLElement>("[data-month]") ?? []) {
      el.toggleAttribute("autofocus", el.dataset.month === month);
    }
  });

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const button = trigger.current;
      const el = panel.current;
      if (!button || !el) return;
      const at = button.getBoundingClientRect();
      const width = el.offsetWidth;
      el.style.left = `${Math.max(GUTTER, Math.min(at.left, window.innerWidth - GUTTER - width))}px`;
      el.style.top = `${at.bottom + GAP}px`;
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function focus(to: YearMonth) {
    moved.current = true;
    setFocused(to);
  }

  function go(to: YearMonth) {
    panel.current?.hidePopover();
    if (to !== month) router.push(keep(monthHref(to, today)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const to = pickerStep(e.key, focused);
    if (!to) return;
    e.preventDefault();
    focus(to);
  }

  const months = SHORT.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}` as YearMonth);
  const inSpan = (m: YearMonth) => m >= monthOf(FIRST_DATE) && m <= monthOf(LAST_DATE);

  return (
    <>
      <button ref={trigger} type="button" popoverTarget={id} aria-haspopup="dialog" aria-expanded={open} className={className}>
        <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="3.5" width="13" height="12" rx="1.5" />
          <path d="M2.5 7h13M6 2v3M12 2v3" />
        </svg>
        Jump to month
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Jump to month"
        onToggle={(e) => {
          const opening = e.newState === "open";
          setOpen(opening);
          if (opening) return;
          setFocused(month);
          if (document.activeElement === document.body || panel.current?.contains(document.activeElement)) trigger.current?.focus();
        }}
        className="inset-auto m-0 w-[min(288px,calc(100vw-32px))] rounded-lg border border-rule bg-sheet p-3 text-ink shadow-float [--ground:var(--sheet)]"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={yearStep}
            disabled={year <= FIRST_DATE.slice(0, 4)}
            onClick={() => setFocused(stepYear(focused, -1))}
            aria-label={`Previous year, ${Number(year) - 1}`}
          >
            <Chevron back />
          </button>
          <p className="font-serif text-lg font-medium tabular" aria-live="polite">
            {year}
          </p>
          <button
            type="button"
            className={yearStep}
            disabled={year >= LAST_DATE.slice(0, 4)}
            onClick={() => setFocused(stepYear(focused, 1))}
            aria-label={`Next year, ${Number(year) + 1}`}
          >
            <Chevron />
          </button>
        </div>
        <div role="group" aria-label={`Months of ${year}`} className="mt-2 grid grid-cols-3 gap-1">
          {months.map((m, i) => {
            const shown = m === month;
            const now = m === thisMonth;
            return (
              <button
                key={m}
                type="button"
                data-month={m}
                tabIndex={m === focused ? 0 : -1}
                disabled={!inSpan(m)}
                aria-label={`${SHORT[i]} ${year}${now ? ", this month" : ""}`}
                aria-current={shown ? "page" : undefined}
                onClick={() => go(m)}
                onKeyDown={onKeyDown}
                className={`relative h-11 rounded-md text-sm font-medium ${
                  shown ? "bg-ink text-paper" : "text-ink-2 hover:bg-hover hover:text-ink active:bg-press"
                } disabled:pointer-events-none disabled:opacity-40`}
              >
                {SHORT[i]}
                {now && (
                  <span aria-hidden="true" className={`absolute inset-x-[30%] bottom-1.5 h-0.5 rounded-full ${shown ? "bg-paper" : "bg-ink"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
