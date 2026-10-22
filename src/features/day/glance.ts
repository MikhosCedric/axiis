import type { LocalDate } from "@/domain/item";
import { utcMidnight } from "@/lib/dates";
import type { TodayEntry, TodayView } from "@/features/today/model";

/** Where a date sits from today, in the words a person would use: "Today", "Tomorrow", "3 days ago". */
export function relativeDay(date: LocalDate, today: LocalDate): string {
  const days = Math.round((utcMidnight(date) - utcMidnight(today)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** An open timed item whose end has passed: its time is over and it was never ticked. */
export function passed(entry: TodayEntry, now: Date): boolean {
  const s = entry.item.schedule;
  return entry.state === "planned" && entry.item.status === "open" && s.kind === "timed" && s.end <= now;
}

/** An open item that falls due on `date` or earlier. */
export function dueBy(entry: TodayEntry, date: LocalDate): boolean {
  return entry.state !== "done" && entry.item.dueOn !== null && entry.item.dueOn <= date;
}

/** How one day stands: how far through it is, what is happening and what comes next. */
export type DayGlance = {
  when: string;
  done: number;
  /** Everything planned on the day, timed or any time. The Inbox is not part of a day. */
  total: number;
  live: TodayEntry[];
  /** The next one to three things to do: happening now, then the next by time, then due, then any time. */
  next: TodayEntry[];
  /** What Focus shows: everything happening now, the next three by time, and everything due today. */
  focus: TodayEntry[];
  /** What Focus folds away that is still open: the rest of the day's plan and of the Inbox. */
  folded: { planned: number; inbox: number };
  /** The first item still to come at a time, for the at-a-glance line. */
  nextTimed: TodayEntry | null;
  /** Open timed items whose time is over. */
  passed: number;
  /** Open items on the day or in the Inbox that fall due on it or before. */
  due: number;
};

export const NEXT_UP_MAX = 3;

const startOf = (e: TodayEntry) => (e.item.schedule.kind === "timed" ? e.item.schedule.start.getTime() : Infinity);

export function dayGlance(view: TodayView, date: LocalDate, today: LocalDate, now: Date): DayGlance {
  const { scheduled } = view;
  const open = scheduled.filter((e) => e.state !== "done");
  const live = open.filter((e) => e.state === "live");
  // On another day, nothing has passed and every time is still to come.
  const isToday = date === today;
  const ahead = open
    .filter((e) => e.state === "planned" && e.item.schedule.kind === "timed" && (!isToday || e.item.schedule.start >= now))
    .sort((a, b) => startOf(a) - startOf(b));
  const anyTime = open.filter((e) => e.item.schedule.kind === "day");
  const due = [...anyTime, ...view.waiting].filter((e) => dueBy(e, date));
  const rest = anyTime.filter((e) => !dueBy(e, date));
  const next = [...live, ...ahead.slice(0, 1), ...due, ...ahead.slice(1), ...rest].slice(0, NEXT_UP_MAX);
  const focus = [...live, ...ahead.slice(0, NEXT_UP_MAX), ...due];
  const inFocus = new Set(focus.map((e) => e.item.id));
  return {
    when: relativeDay(date, today),
    done: scheduled.length - open.length,
    total: scheduled.length,
    live,
    next,
    focus,
    folded: {
      planned: open.filter((e) => !inFocus.has(e.item.id)).length,
      inbox: view.waiting.filter((e) => e.state !== "done" && !inFocus.has(e.item.id)).length,
    },
    nextTimed: ahead[0] ?? null,
    passed: isToday ? open.filter((e) => passed(e, now)).length : 0,
    due: due.length,
  };
}

/**
 * The at-a-glance line: "Today · 3 of 8 done · now: Focus block · next: Design sync at 16:00",
 * or "Nothing left today" once everything is done. `at` writes a time on the reader's clock.
 */
export function glanceLine(g: DayGlance, at: (d: Date) => string): string {
  const parts = [g.when];
  const isToday = g.when === "Today";
  if (g.total === 0) parts.push(isToday ? "Nothing planned" : "Nothing planned on this day");
  else if (g.done === g.total) parts.push(isToday ? "Nothing left today" : `All ${g.total} done`);
  else {
    parts.push(`${g.done} of ${g.total} done`);
    if (g.live.length) parts.push(`now: ${g.live.map((e) => e.item.title).join(", ")}`);
    const n = g.nextTimed;
    if (n && n.item.schedule.kind === "timed") parts.push(`next: ${n.item.title} at ${at(n.item.schedule.start)}`);
  }
  if (g.due) parts.push(`${g.due} due`);
  return parts.join(" · ");
}

/** What Focus folds away, counted: "6 more planned · 4 in the Inbox · 2 left over · 3 done". */
export function foldedWords(g: DayGlance, leftover: number): string {
  const parts = [
    g.folded.planned > 0 && `${g.folded.planned} more planned`,
    g.folded.inbox > 0 && `${g.folded.inbox} in the Inbox`,
    leftover > 0 && `${leftover} left over`,
    g.done > 0 && `${g.done} done`,
  ].filter((p): p is string => typeof p === "string");
  return parts.length ? parts.join(" · ") : "Nothing else";
}

/**
 * The at-a-glance line of a week or a month: "This week · 2 days left · 5 open · 2 due".
 * Days left counts today. A span wholly past or ahead says where it is from today instead.
 */
export function spanLine(span: { first: LocalDate; last: LocalDate; noun: "week" | "month"; open: number; due: number }, today: LocalDate): string {
  const { first, last, noun, open, due } = span;
  const counts = [open ? `${open} open` : "Nothing open", ...(due ? [`${due} due`] : [])];
  if (today < first || today > last) return [relativeSpan(first, today, noun), ...counts].join(" · ");
  const left = Math.round((utcMidnight(last) - utcMidnight(today)) / 86_400_000) + 1;
  return [`This ${noun}`, left === 1 ? "Last day" : `${left} days left`, ...counts].join(" · ");
}

function relativeSpan(first: LocalDate, today: LocalDate, noun: "week" | "month"): string {
  const ahead = first > today;
  if (noun === "week") {
    // A week ahead starts 1 to 7 days on; a week behind started 7 to 13 days back.
    const days = Math.abs(utcMidnight(first) - utcMidnight(today)) / 86_400_000;
    const weeks = ahead ? Math.ceil(days / 7) : Math.floor(days / 7);
    if (weeks === 1) return ahead ? "Next week" : "Last week";
    return ahead ? `In ${weeks} weeks` : `${weeks} weeks ago`;
  }
  const months = (Number(first.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(first.slice(5, 7)) - Number(today.slice(5, 7));
  if (months === 1) return "Next month";
  if (months === -1) return "Last month";
  return ahead ? `In ${months} months` : `${-months} months ago`;
}
