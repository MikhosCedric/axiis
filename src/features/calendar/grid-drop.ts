import type { LocalDate, ShownItem } from "@/domain/item";
import { changes, DEFAULT_MINUTES, MIN_MINUTES, type Placement } from "@/features/score/drop";
import { clamp, SNAP_MINUTES, snap } from "@/features/score/snap";
import { addDays, instantAt, localMinutes, toLocalDate, utcMidnight } from "@/lib/dates";
import { formatMinutes, type Clock } from "@/lib/clock";
import { DAY_MINUTES, minutesAtY } from "./grid-layout";

// What a gesture on the grid asks for, as the `Placement` the Score's `placeItem` command already saves.
// Times are built from wall-clock minutes with `instantAt`, never by adding hours to an instant.

export { changes, DEFAULT_MINUTES, MIN_MINUTES, type Placement };

const DAY_MS = 86_400_000;
const daysBetween = (from: LocalDate, to: LocalDate) => Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);

/** A pointer's offset down a day column as minutes, held inside the day. */
export function minutesAt(y: number): number {
  return clamp(minutesAtY(y), 0, DAY_MINUTES);
}

/** Where a timed item starts: its own day and the wall-clock minutes of its start and end from that day's midnight. */
export function wallSpan(item: ShownItem, timeZone: string): { day: LocalDate; start: number; end: number } | null {
  const s = item.schedule;
  if (s.kind !== "timed") return null;
  const day = toLocalDate(s.start, timeZone);
  const start = localMinutes(s.start, day, timeZone);
  return { day, start, end: Math.max(start, localMinutes(s.end, day, timeZone)) };
}

/** The wall-clock length an item keeps when it moves: its own, or `fallback` for one with no time yet. */
export function lengthOf(item: ShownItem, timeZone: string, fallback = DEFAULT_MINUTES): number {
  const span = wallSpan(item, timeZone);
  return span ? Math.max(MIN_MINUTES, span.end - span.start) : fallback;
}

function timed(day: LocalDate, start: number, length: number, timeZone: string): Placement {
  return { schedule: { kind: "timed", start: instantAt(day, start, timeZone), end: instantAt(day, start + length, timeZone) } };
}

/**
 * Put `item` on `day` starting near `start` (minutes, unsnapped): a drag within a column, across columns,
 * or out of the any-time row. It keeps its length and snaps to the quarter hour. The start stays inside the
 * day, except for an item that already crosses midnight, whose start may be carried into the day before
 * when the part of it after midnight is what was dragged.
 */
export function moveTo(item: ShownItem, day: LocalDate, start: number, timeZone: string, fallback = DEFAULT_MINUTES): Placement {
  const length = lengthOf(item, timeZone, fallback);
  const span = wallSpan(item, timeZone);
  const crosses = span !== null && span.end > DAY_MINUTES;
  let from = snap(start);
  let on = day;
  if (crosses && from < 0) {
    on = addDays(day, -1);
    from += DAY_MINUTES;
  }
  from = clamp(from, 0, DAY_MINUTES - SNAP_MINUTES);
  return timed(on, from, length, timeZone);
}

/**
 * Move a timed item's end near `end`, minutes on `day` (the day of the column its bottom edge is in).
 * It keeps at least a quarter hour and never runs past that day's midnight.
 */
export function resizeTo(item: ShownItem, day: LocalDate, end: number, timeZone: string): Placement | null {
  const span = wallSpan(item, timeZone);
  if (!span) return null;
  const to = clamp(snap(end), 0, DAY_MINUTES) + daysBetween(span.day, day) * DAY_MINUTES;
  return timed(span.day, span.start, Math.max(MIN_MINUTES, to - span.start), timeZone);
}

/** Plan `item` for `day` with no time: a drop on the any-time row. */
export const toAnyTime = (day: LocalDate): Placement => ({ schedule: { kind: "day", on: day } });

/** A stretch of empty time picked for a new item. */
export type Slot = { day: LocalDate; start: number; length: number };

/**
 * The slot a press on empty time asks for. A click (`to` equal to `from`, or within a quarter hour of it)
 * takes the quarter hour under the pointer and the default length; a drag runs from the quarter hour it
 * began in to the one it ended in, either way up.
 */
export function slotFor(day: LocalDate, from: number, to: number, fallback = DEFAULT_MINUTES): Slot {
  const floor = (m: number) => Math.floor(clamp(m, 0, DAY_MINUTES - 1) / SNAP_MINUTES) * SNAP_MINUTES;
  const a = floor(Math.min(from, to));
  const b = floor(Math.max(from, to));
  if (a === b) return { day, start: a, length: Math.min(fallback, DAY_MINUTES - a) };
  return { day, start: a, length: b + SNAP_MINUTES - a };
}

/**
 * A slot in the words capture reads, to follow a title: " tomorrow 14:00 for 45m". Capture counts days
 * from today, so today and tomorrow are said in words and any other day by its date.
 */
export function slotWords(slot: Slot, today: LocalDate, clock: Clock): string {
  const day = slot.day === today ? "today" : slot.day === addDays(today, 1) ? "tomorrow" : slot.day;
  const at = formatMinutes(slot.start, clock).replace(/\s/g, "").toLowerCase();
  const hours = Math.floor(slot.length / 60);
  const minutes = slot.length % 60;
  const length = `${hours ? `${hours}h` : ""}${hours && minutes ? " " : ""}${minutes ? `${minutes}m` : ""}`;
  return ` ${day} ${at} for ${length}`;
}

export type GridPress = { key: string; shiftKey: boolean; altKey: boolean };

export type KeyContext = {
  days: readonly LocalDate[];
  timeZone: string;
  /** Local minutes of now when today is among the days shown, else null. */
  now: number | null;
  today: LocalDate;
  fallback?: number;
};

/**
 * The placement a key asks for on a block or an any-time item, or null when the key is not one of these or
 * would change nothing. With Alt: Up and Down move a block a quarter hour, Left and Right a day (inside the
 * days shown); Alt Down gives an any-time item a time, and Alt Home (or Alt Up at midnight) takes a block's time away. With Shift: Up and
 * Down change a block's length.
 */
export function keyPlacement(ctx: KeyContext, item: ShownItem, press: GridPress): Placement | null {
  const { timeZone } = ctx;
  const span = wallSpan(item, timeZone);
  const s = item.schedule;
  const day = span?.day ?? (s.kind === "day" ? s.on : null);
  if (!day) return null;
  const vertical = press.key === "ArrowDown" ? 1 : press.key === "ArrowUp" ? -1 : 0;
  const sideways = press.key === "ArrowRight" ? 1 : press.key === "ArrowLeft" ? -1 : 0;
  let next: Placement | null = null;

  if (press.altKey && !press.shiftKey && sideways) {
    const to = addDays(day, sideways);
    if (!ctx.days.includes(to)) return null;
    next = span ? timed(to, span.start, span.end - span.start || MIN_MINUTES, timeZone) : toAnyTime(to);
  } else if (press.altKey && !press.shiftKey && vertical) {
    if (!span) {
      if (vertical < 0) return null;
      const start = day === ctx.today && ctx.now !== null ? Math.ceil(ctx.now / SNAP_MINUTES) * SNAP_MINUTES : 9 * 60;
      next = moveTo(item, day, start, timeZone, ctx.fallback);
    } else if (vertical < 0 && span.start === 0) {
      next = toAnyTime(day);
    } else {
      next = moveTo(item, day, snap(span.start) + vertical * SNAP_MINUTES, timeZone);
    }
  } else if (press.altKey && !press.shiftKey && press.key === "Home" && span) {
    next = toAnyTime(day);
  } else if (press.shiftKey && !press.altKey && vertical && span) {
    const end = snap(span.end) + vertical * SNAP_MINUTES;
    next = timed(span.day, span.start, clamp(end, span.start + MIN_MINUTES, span.start + DAY_MINUTES) - span.start, timeZone);
  }
  return next && changes(item, next) ? next : null;
}
