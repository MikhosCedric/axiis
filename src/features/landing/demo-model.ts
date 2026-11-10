import { SNAP_MINUTES, clamp, snap } from "@/features/score/snap";
import { cadenceWords, ruleDay, weekdayNames } from "@/features/today/capture-repeat";
import { dayWordText, parseCapture, type DayWord, type RepeatWords } from "@/features/today/capture-syntax";
import type { Weekday } from "@/domain/recurrence";
import type { TagName } from "@/domain/tag";

/**
 * Where a captured line lands, as the real capture decides it: a time puts it on a line, a day alone in
 * Any time, neither in the Inbox. `day` is the parser's own words for the day ("tomorrow", "next Friday").
 */
export type Placement =
  | { kind: "nothing" }
  | { kind: "inbox"; title: string; tags: TagName[] }
  | { kind: "anytime"; title: string; day: string; tags: TagName[]; repeats: Repeats | null }
  | { kind: "timed"; title: string; day: string; start: number; end: number; tags: TagName[]; repeats: Repeats | null };

/**
 * How a captured line repeats, in the parser's own words ("every other Tuesday"), and the days of a
 * sample week it falls on, Monday first (0) to Sunday (6). `week` is empty when the week alone cannot
 * show it: every other week, every 3 days, every month, or a weekly repeat whose day is today's.
 */
export type Repeats = { words: string; week: number[] };

/** Monday first, as the sample week is drawn. */
const WEEK: readonly Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function repeatsOf(repeat: RepeatWords, typed: DayWord | null): { label: string; repeats: Repeats } {
  const typedDay = typed?.kind === "weekday" ? ruleDay(typed.weekday) : null;
  const words = cadenceWords(repeat, typedDay);
  if (repeat.freq !== "weekly") {
    const week = repeat.freq === "daily" && repeat.interval === 1 ? [0, 1, 2, 3, 4, 5, 6] : [];
    return { label: typed ? dayWordText(typed) : capitalise(words), repeats: { words, week } };
  }
  const days = repeat.byDay.length > 0 ? repeat.byDay : typedDay ? [typedDay] : [];
  const week = repeat.interval === 1 ? days.map((d) => WEEK.indexOf(d)).sort((a, b) => a - b) : [];
  // A row name says where it lands in a few words; one that skips weeks is said whole, so it is not read as every week.
  const label = typed
    ? dayWordText(typed)
    : repeat.interval !== 1
      ? capitalise(words)
      : words === "every weekday"
        ? "Weekdays"
        : words === "every weekend"
          ? "Weekends"
          : days.length === 1
            ? `${weekdayNames(days)}s`
            : days.length > 1
              ? week.map((i) => SHORT[i]).join(", ")
              : "Each week";
  return { label, repeats: { words, week } };
}

/**
 * The app's own numbers, written here so the landing does not carry the modules that hold them;
 * demo-model.test.ts checks each against its source.
 */
export const LANDING_DEFAULT_MINUTES = 30;
export const LANDING_NEXT_UP_MAX = 3;

export function placeCapture(text: string): Placement {
  if (!text.trim()) return { kind: "nothing" };
  const read = parseCapture(text);
  // A repeat is always planned, as capture plans it: its row is named for the days it falls on.
  const repeat = read.repeat ? repeatsOf(read.repeat, read.day) : null;
  const day = repeat?.label ?? (read.day ? dayWordText(read.day) : "today");
  const repeats = repeat?.repeats ?? null;
  if (read.time) {
    const end = read.time.start + (read.time.length ?? LANDING_DEFAULT_MINUTES);
    return { kind: "timed", title: read.title, day, start: read.time.start, end, tags: read.tags, repeats };
  }
  if (read.day || repeats) return { kind: "anytime", title: read.title, day, tags: read.tags, repeats };
  return { kind: "inbox", title: read.title, tags: read.tags };
}

/** A stretch of one day in minutes past midnight. */
export type Span = { start: number; end: number };

/** The drag demo's staff: 08:00 to 20:00. */
export const DRAG_AXIS: Span = { start: 8 * 60, end: 20 * 60 };

const fit = (span: Span): Span => {
  const length = span.end - span.start;
  const start = clamp(span.start, DRAG_AXIS.start, DRAG_AXIS.end - length);
  return { start, end: start + length };
};

/** The beam moved by `minutes` from where the drag began, on the quarter hour and inside the staff. */
export function moveBy(from: Span, minutes: number): Span {
  return fit({ start: snap(from.start + minutes), end: snap(from.start + minutes) + (from.end - from.start) });
}

/** The beam's end pulled by `minutes`, never shorter than a quarter hour or past the staff. */
export function resizeBy(from: Span, minutes: number): Span {
  return { start: from.start, end: clamp(snap(from.end + minutes), from.start + SNAP_MINUTES, DRAG_AXIS.end) };
}

/** The Score's keys on a focused beam: arrows move a quarter hour, with Shift they change its end. */
export function keySpan(span: Span, key: string, shiftKey: boolean): Span | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const step = key === "ArrowRight" ? SNAP_MINUTES : -SNAP_MINUTES;
  return shiftKey ? resizeBy(span, step) : moveBy(span, step);
}

/** One row of the Focus demo's day. */
export type DayRow = { id: string; title: string; start: number; end: number; done: boolean };

/** What Focus keeps in view: what is happening, then the next few by time; the rest is folded and counted. */
export function focusSplit(rows: readonly DayRow[], now: number): { kept: DayRow[]; planned: number; done: number } {
  const open = rows.filter((r) => !r.done).sort((a, b) => a.start - b.start);
  const happening = open.filter((r) => r.start <= now && now < r.end);
  const next = open.filter((r) => r.start > now).slice(0, LANDING_NEXT_UP_MAX);
  const kept = [...happening, ...next];
  return { kept, planned: open.length - kept.length, done: rows.filter((r) => r.done).length };
}

/** The folded summary's words, as Today writes them: "4 more planned · 2 done". */
export function foldedLine(split: { planned: number; done: number }): string {
  const parts = [split.planned > 0 && `${split.planned} more planned`, split.done > 0 && `${split.done} done`].filter(
    (p): p is string => typeof p === "string",
  );
  return parts.length ? parts.join(" · ") : "Nothing else";
}
