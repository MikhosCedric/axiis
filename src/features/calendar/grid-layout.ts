import type { LocalDate, ShownItem } from "@/domain/item";
import { localMinutes, toLocalDate } from "@/lib/dates";

// The calendar's vertical time grid: hours run down, days are columns. Everything here is wall-clock minutes
// past a day's local midnight, read with `localMinutes`, so a 23 or 25 hour day still draws 24 rows and an
// item keeps the times its clock shows.

export const DAY_MINUTES = 24 * 60;
export const HOUR_PX = 52;
export const PX_PER_MINUTE = HOUR_PX / 60;
export const GRID_PX = 24 * HOUR_PX;
/** The least a block is drawn tall, so a five-minute item still shows its title. */
export const MIN_BLOCK_PX = 22;
/** What that height is worth in minutes: two short blocks closer than this share the width instead of covering each other. */
const MIN_BLOCK_MINUTES = Math.ceil(MIN_BLOCK_PX / PX_PER_MINUTE);
/** The hour a day that is not today opens on. */
export const OPEN_AT = 7 * 60;

/** How many days the grid shows at once. */
export type CalendarMode = "day" | "3day" | "week";
export const MODE_DAYS: Record<CalendarMode, number> = { day: 1, "3day": 3, week: 7 };

export const yAt = (minutes: number) => minutes * PX_PER_MINUTE;
export const minutesAtY = (y: number) => y / PX_PER_MINUTE;

/** The part of a timed item that falls on one day, `[start, end)` in that day's minutes. */
export type Segment = {
  start: number;
  end: number;
  /** It began on an earlier day, so this part starts at midnight. */
  before: boolean;
  /** It runs on past midnight, so this part ends there. */
  after: boolean;
};

/** Where a timed item sits on `date`, clipped to the day, or null when none of it falls there. */
export function segmentOn(item: ShownItem, date: LocalDate, timeZone: string): Segment | null {
  const s = item.schedule;
  if (s.kind !== "timed") return null;
  const start = localMinutes(s.start, date, timeZone);
  const end = Math.max(start, localMinutes(s.end, date, timeZone));
  // An item with no length sits on the day it starts; one that ends at midnight does not reach the next day.
  const here = end > start ? end > 0 && start < DAY_MINUTES : start >= 0 && start < DAY_MINUTES;
  if (!here) return null;
  return { start: Math.max(0, start), end: Math.min(DAY_MINUTES, end), before: start < 0, after: end > DAY_MINUTES };
}

export type Block = Segment & {
  item: ShownItem;
  top: number;
  height: number;
  /** Its column among the items it overlaps, from 0, and how many columns that group has. */
  column: number;
  columns: number;
  /** How many columns it is drawn across: it widens into free columns to its right. */
  span: number;
};

export type DayColumn = {
  date: LocalDate;
  /** Items planned for the day with no time, in their own order. */
  anyTime: ShownItem[];
  blocks: Block[];
};

type Placed = Segment & { item: ShownItem; until: number; column: number };

const drawn = (item: ShownItem) => item.type !== "note" && item.status !== "dropped";

/**
 * Packs one day's segments side by side, as a calendar does: items that overlap (as drawn, so a short
 * one counts for its least height) form a group that shares the column width; each takes the first
 * column free at its start, and widens over the columns to its right that nothing in its way uses.
 */
export function packDay(segments: (Segment & { item: ShownItem })[]): Block[] {
  const sorted = [...segments].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.item.title.localeCompare(b.item.title) || a.item.id.localeCompare(b.item.id),
  );
  const blocks: Block[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;

  const flush = () => {
    const columns = group.reduce((n, p) => Math.max(n, p.column + 1), 0);
    for (const p of group) {
      let span = 1;
      while (p.column + span < columns && !group.some((q) => q.column === p.column + span && q.start < p.until && p.start < q.until)) span++;
      const { until, ...rest } = p;
      void until;
      blocks.push({ ...rest, columns, span, top: yAt(p.start), height: Math.max(MIN_BLOCK_PX, yAt(p.end - p.start)) });
    }
    group = [];
  };

  for (const seg of sorted) {
    const until = Math.max(seg.end, seg.start + MIN_BLOCK_MINUTES);
    if (group.length && seg.start >= groupEnd) flush();
    const ends: number[] = [];
    for (const p of group) ends[p.column] = Math.max(ends[p.column] ?? 0, p.until);
    let column = ends.findIndex((end) => end === undefined || end <= seg.start);
    if (column < 0) column = ends.length;
    group.push({ ...seg, until, column });
    groupEnd = Math.max(groupEnd, until);
  }
  flush();
  return blocks;
}

/** The now line: which day column it crosses and how far down, or null when today is not shown. */
export type NowLine = { day: number; minutes: number; top: number };

export function nowLine(days: readonly LocalDate[], now: Date, timeZone: string): NowLine | null {
  const day = days.indexOf(toLocalDate(now, timeZone));
  if (day < 0) return null;
  const minutes = localMinutes(now, days[day], timeZone);
  return { day, minutes, top: yAt(minutes) };
}

/**
 * The minute the grid opens scrolled to: an hour and a half before now when today is shown, else 07:00,
 * on a whole hour so the first hour label reads whole.
 */
export function openMinute(now: NowLine | null): number {
  if (!now) return OPEN_AT;
  return Math.max(0, Math.floor((now.minutes - 90) / 60) * 60);
}

export type GridLayout = { columns: DayColumn[]; now: NowLine | null };

/** A span of days and their items as positioned blocks. Notes, dropped items and anything outside the span are left out. */
export function layoutGrid({
  days,
  items,
  timeZone,
  now,
}: {
  days: readonly LocalDate[];
  items: readonly ShownItem[];
  timeZone: string;
  now: Date;
}): GridLayout {
  const shown = items.filter(drawn);
  const columns = days.map((date): DayColumn => {
    const anyTime = shown
      .filter((i) => i.schedule.kind === "day" && i.schedule.on === date)
      .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const segments = shown.flatMap((item) => {
      const seg = segmentOn(item, date, timeZone);
      return seg ? [{ ...seg, item }] : [];
    });
    return { date, anyTime, blocks: packDay(segments) };
  });
  return { columns, now: nowLine(days, now, timeZone) };
}

/** Left offset and width of a block inside its day column, as fractions of the column. */
export function blockBox(block: Pick<Block, "column" | "columns" | "span">): { left: number; width: number } {
  return { left: block.column / block.columns, width: block.span / block.columns };
}
