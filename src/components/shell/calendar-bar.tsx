"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { LocalDate } from "@/domain/item";
import { dayHref, isTypingTarget, navTarget, shortcutAction, type DayNavAction } from "@/features/day/nav";
import type { DayViewMode } from "@/features/day/types";
import { useKeepFilter } from "@/features/filter/keep-filter";
import { addMonths, anchorOf, firstOf, formatMonthHeading, monthHref, monthNavTarget, monthOf } from "@/features/month/model";
import { formatDayHeading } from "@/features/today/format";
import { anchorDay, daysHref, NARROW_DAYS, narrowDays, formatWeekHeading, weekHref, weekNavTarget, weekOf } from "@/features/week/model";
import { keepSpans, spanHrefs, spanShortcut, type Span } from "@/features/week/span";
import { addDays, FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";
import { placeNear } from "@/lib/placement";
import { useNarrow } from "@/lib/use-narrow";
import { MiniMonth } from "./mini-month";
import { useWeekStart } from "./week-start-context";

const button =
  "inline-flex h-9 flex-none items-center justify-center rounded-md border border-rule bg-sheet font-medium text-ink shadow-raise hover:bg-paper-2 active:translate-y-px active:bg-press pointer-coarse:h-11";

function Chevron({ to }: { to: "back" | "on" | "down" }) {
  const d = to === "back" ? "M11 4L6 9l5 5" : to === "on" ? "M7 4l5 5-5 5" : "M4 7l5 5 5-5";
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
      <path d={d} />
    </svg>
  );
}

/** A neighbouring day, week or month. It is fetched only once a pointer rests on it or focus reaches it. */
function StepLink({ href, className, children, ...rest }: { href: string; className: string; children: ReactNode; "aria-keyshortcuts": string; title: string }) {
  const [warm, setWarm] = useState(false);
  return (
    <Link href={href} prefetch={warm} onPointerEnter={() => setWarm(true)} onFocus={() => setWarm(true)} className={className} {...rest}>
      {children}
    </Link>
  );
}

const NAMES: Record<Span, { nav: string; one: string; now: string }> = {
  day: { nav: "Day", one: "day", now: "today" },
  week: { nav: "Week", one: "week", now: "this week" },
  month: { nav: "Month", one: "month", now: "this month" },
};

/** What the bar needs of the span on screen: its title, its neighbours and where its links go. */
function spanOf(span: Span, date: LocalDate, today: LocalDate, mode: DayViewMode, startsOn: 0 | 1) {
  if (span === "day") {
    return {
      title: formatDayHeading(date),
      atNow: date === today,
      anchor: date,
      from: date,
      to: date,
      step: (action: DayNavAction) => navTarget(action, date, today),
      same: (to: LocalDate) => to === date,
      href: (to: LocalDate) => dayHref(to, today, mode),
      name: (to: LocalDate) => formatDayHeading(to),
    };
  }
  if (span === "week") {
    const days = weekOf(date, startsOn);
    return {
      title: formatWeekHeading(days),
      atNow: days.includes(today),
      anchor: anchorDay(days, today),
      from: days[0],
      to: days[days.length - 1],
      step: (action: DayNavAction) => weekNavTarget(action, days[0], today, startsOn),
      same: (to: LocalDate) => weekOf(to, startsOn)[0] === days[0],
      href: (to: LocalDate) => weekHref(to, today, startsOn),
      name: (to: LocalDate) => formatWeekHeading(weekOf(to, startsOn)),
    };
  }
  const month = monthOf(date);
  return {
    title: formatMonthHeading(month),
    atNow: month === monthOf(today),
    anchor: anchorOf(month, today),
    from: firstOf(month),
    to: addDays(firstOf(addMonths(month, 1)), -1),
    step: (action: DayNavAction) => firstOf(monthNavTarget(action, month, today)),
    same: (to: LocalDate) => monthOf(to) === month,
    href: (to: LocalDate) => monthHref(monthOf(to), today),
    name: (to: LocalDate) => formatMonthHeading(monthOf(to)),
  };
}

const THREE_DAYS = { nav: "Week", one: "three days", now: "today" };

/** The Week on a narrow screen: three days from `from`, stepped three at a time. Its address names the first of them. */
function threeDays(from: LocalDate, today: LocalDate): ReturnType<typeof spanOf> {
  const days = narrowDays(from);
  return {
    title: formatWeekHeading(days),
    atNow: from === today,
    anchor: days.includes(today) ? today : from,
    from,
    to: days[days.length - 1],
    step: (action: DayNavAction) => (action === "today" ? today : addDays(from, action === "next" ? NARROW_DAYS : -NARROW_DAYS)),
    same: (to: LocalDate) => to === from,
    href: (to: LocalDate) => daysHref(to, today),
    name: (to: LocalDate) => formatWeekHeading([to, addDays(to, NARROW_DAYS - 1)]),
  };
}

/**
 * The one bar at the top of the Day, the Week and the Month (ADR-0004): Today, the steps back and
 * on, and the range as the page's title. The title opens a small month to jump by, with a field
 * for a typed date under it. It holds no switch between the three: the side panel is the only one,
 * and D, W and M do the same from the keyboard. `[`, `]` and T step as they always have.
 *
 * It draws no box of its own: Today, the steps and the title are laid out by the page header's top row, so on a
 * narrow page the title drops to a line of its own under Today, the steps and the page's controls.
 *
 * `date` is the day on screen, the first day of the week, or any day of the month.
 */
export function CalendarBar({
  span,
  date,
  today,
  mode = "grid",
  from = null,
  titleId,
}: {
  span: Span;
  date: LocalDate;
  today: LocalDate;
  mode?: DayViewMode;
  /** On the Week, the day its address names: a narrow screen shows three days from it and steps by three. */
  from?: LocalDate | null;
  /** The id the page's title carries, for the regions the view labels by it. */
  titleId: string;
}) {
  const router = useRouter();
  const startsOn = useWeekStart();
  const keep = useKeepFilter();
  // Three days of the week on a narrow screen (ADR-0004): the title, the steps and the keys all speak of those three.
  const three = useNarrow() && span === "week" ? from : null;
  const words = three ? THREE_DAYS : NAMES[span];
  const now = three ? threeDays(three, today) : spanOf(span, date, today, mode, startsOn);
  const previous = now.step("previous");
  const next = now.step("next");
  const { anchor } = now;

  // A layout effect, so the listener for this page is swapped in the same commit that draws it. A passive effect
  // left the last page's listener on for a moment after the new one showed, and a quick ] then moved two steps.
  useLayoutEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const press = {
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        isComposing: e.isComposing,
        defaultPrevented: e.defaultPrevented,
        typing: target !== null && isTypingTarget(target),
      };
      const here = three ? threeDays(three, today) : spanOf(span, date, today, mode, startsOn);
      const action = shortcutAction(press);
      if (action) {
        const to = here.step(action);
        if (here.same(to)) return;
        e.preventDefault();
        router.push(keep(here.href(to)));
        return;
      }
      // D, W and M: the day, week or month that holds the day on screen. A dialog keeps its own keys.
      const other = spanShortcut(press);
      if (!other || other === span || e.shiftKey || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      router.push(keepSpans(spanHrefs(here.anchor, today, mode, startsOn), keep)[other]);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, span, date, today, mode, startsOn, keep, three]);

  const gap = now.title.indexOf(" ");

  return (
    <div data-calendar-bar={span} className="contents">
      <nav aria-label={words.nav} className="flex flex-none items-center gap-2">
        <Link
          href={keep(now.href(today))}
          aria-keyshortcuts="t"
          aria-current={now.atNow ? "true" : undefined}
          title={now.atNow ? `Showing ${words.now}` : `Back to ${words.now} ( T )`}
          className={`${button} px-3.5 ${now.atNow ? "text-ink-2" : ""}`}
        >
          Today
        </Link>
        {/* One pair, so the steps never wrap apart. */}
        <span className="inline-flex flex-none">
          <StepLink href={keep(now.href(previous))} className={`${button} w-11 rounded-r-none`} aria-keyshortcuts="[" title={`Previous ${words.one} ( [ )`}>
            <Chevron to="back" />
            <span className="sr-only">
              Previous {words.one}, {now.name(previous)}
            </span>
          </StepLink>
          <StepLink href={keep(now.href(next))} className={`${button} -ml-px w-11 rounded-l-none`} aria-keyshortcuts="]" title={`Next ${words.one} ( ] )`}>
            <Chevron to="on" />
            <span className="sr-only">
              Next {words.one}, {now.name(next)}
            </span>
          </StepLink>
        </span>
      </nav>
      <DateJump titleId={titleId} today={today} anchor={anchor} from={now.from} to={now.to} hrefFor={(to) => keep(now.href(to))} same={now.same}>
        {/* A day's weekday is set lighter, so the date itself leads. */}
        {span === "day" && gap > 0 ? (
          <time dateTime={date}>
            <span className="font-normal text-ink-2">{now.title.slice(0, gap)}</span>
            {now.title.slice(gap)}
          </time>
        ) : (
          now.title
        )}
      </DateJump>
    </div>
  );
}

const GAP = 6;
const GUTTER = 16;

/**
 * The title as the way to another date: a native popover under it with the small month, and under
 * that a field for a date typed by hand, which goes on Enter. Escape and a click outside close it,
 * and focus goes back to the title.
 */
function DateJump({
  titleId,
  today,
  anchor,
  from,
  to,
  hrefFor,
  same,
  children,
}: {
  titleId: string;
  today: LocalDate;
  anchor: LocalDate;
  from: LocalDate;
  to: LocalDate;
  hrefFor: (date: LocalDate) => string;
  same: (date: LocalDate) => boolean;
  children: ReactNode;
}) {
  const id = useId();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const at = trigger.current?.getBoundingClientRect();
      const el = panel.current;
      if (!at || !el) return;
      const { left, top } = placeNear(at, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, GAP, GUTTER);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const close = () => panel.current?.hidePopover();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("date") as HTMLInputElement;
    const picked = parseLocalDate(input.value);
    if (!picked || !input.validity.valid) return;
    close();
    if (!same(picked)) router.push(hrefFor(picked));
  }

  return (
    <>
      <h1 id={titleId} className="headline min-w-0 @max-[56rem]/page:order-3 @max-[56rem]/page:basis-full @min-[56rem]/page:whitespace-nowrap max-rail:order-2! max-rail:flex-1 max-rail:basis-0! max-rail:text-[22px] max-rail:leading-[1.1]">
        <button
          ref={trigger}
          type="button"
          popoverTarget={id}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Go to another date"
          className="-mx-2 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5 text-left hover:bg-hover active:bg-press [&>svg]:text-ink-3"
        >
          <span className="min-w-0">{children}</span>
          <Chevron to="down" />
        </button>
      </h1>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Go to a date"
        onToggle={(e) => {
          const opening = e.newState === "open";
          setOpen(opening);
          if (opening) panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
          else if (document.activeElement === document.body || panel.current?.contains(document.activeElement)) trigger.current?.focus();
        }}
        className="inset-auto m-0 w-[min(264px,calc(100vw-32px))] rounded-lg border border-rule bg-sheet p-3 text-ink shadow-float [--ground:var(--sheet)]"
      >
        <MiniMonth today={today} anchor={anchor} from={from} to={to} hrefFor={hrefFor} onGo={close} autoFocus />
        <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2 border-t border-rule-soft pt-3">
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-ink-2">
            Go to date
            <input
              key={anchor}
              name="date"
              type="date"
              required
              min={FIRST_DATE}
              max={LAST_DATE}
              defaultValue={anchor}
              className="h-9 w-full min-w-0 rounded-md border border-field bg-sheet px-2 text-[13px] font-normal text-ink tabular focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent pointer-coarse:h-11"
            />
          </label>
          <button type="submit" className={`${button} px-3`}>
            Go
          </button>
        </form>
      </div>
    </>
  );
}
