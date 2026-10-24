import { NEXT_UP_MAX } from "@/features/day/glance";
import { DEFAULT_MINUTES } from "@/features/score/drop";
import { SNAP_MINUTES, clamp, snap } from "@/features/score/snap";
import { dayWordText, parseCapture } from "@/features/today/capture-syntax";
import type { TagName } from "@/domain/tag";

/** Where a captured line lands, as the real capture decides it: a time puts it on a line, a day alone in Any time, neither in the Inbox. */
export type Placement =
  | { kind: "nothing" }
  | { kind: "inbox"; title: string; tags: TagName[] }
  | { kind: "anytime"; title: string; day: string; tags: TagName[] }
  | { kind: "timed"; title: string; day: string; start: number; end: number; tags: TagName[] };

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function placeCapture(text: string): Placement {
  if (!text.trim()) return { kind: "nothing" };
  const read = parseCapture(text);
  const day = read.day ? capital(dayWordText(read.day)) : "Today";
  if (read.time) {
    const end = read.time.start + (read.time.length ?? DEFAULT_MINUTES);
    return { kind: "timed", title: read.title, day, start: read.time.start, end, tags: read.tags };
  }
  if (read.day) return { kind: "anytime", title: read.title, day, tags: read.tags };
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
  const next = open.filter((r) => r.start > now).slice(0, NEXT_UP_MAX);
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
