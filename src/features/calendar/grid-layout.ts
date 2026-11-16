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
/** The hour a day that is not today opens on, when nothing is planned earlier. */
export const OPEN_AT = 7 * 60;
/** The visible range always holds at least these hours (07:00 to 22:00), and one hour past what is planned. */
export const RANGE_FROM = 7 * 60;
export const RANGE_TO = 22 * 60;
/** The least and most an hour is drawn tall when the range is fitted to the window. */
export const MIN_HOUR_PX = 44;
export const MAX_HOUR_PX = 88;

/** How many days the grid shows at once. */
export type CalendarMode = "day" | "3day" | "week";
export const MODE_DAYS: Record<CalendarMode, number> = { day: 1, "3day": 3, week: 7 };

/**
 * What part of the day is drawn and how tall a minute is: `from` and `to` are minutes past midnight
 * (whole hours), `ppm` pixels per minute. A column's top edge is `from`.
 */
export type Scale = { from: number; to: number; ppm: number };
export const FULL_DAY: Scale = { from: 0, to: DAY_MINUTES, ppm: PX_PER_MINUTE };
export const scaleOf = (from: number, to: number, hourPx: number): Scale => ({ from, to, ppm: hourPx / 60 });

export const yAt = (minutes: number, scale: Scale = FULL_DAY) => (minutes - scale.from) * scale.ppm;
export const minutesAtY = (y: number, scale: Scale = FULL_DAY) => scale.from + y / scale.ppm;
/** The drawn height of the whole range. */
export const gridHeight = (scale: Scale) => (scale.to - scale.from) * scale.ppm;
/** What a height is worth in minutes: two short blocks closer than this share the width instead of covering each other. */
const minBlockMinutes = (scale: Scale) => Math.ceil(MIN_BLOCK_PX / scale.ppm);

/**
 * The hours drawn by default: from an hour before the earliest planned thing, or 07:00 if that is earlier,
 * to an hour after the latest, or 22:00 if that is later, on whole hours. Today's now counts as planned so
 * the line is never off the page. `earlier` and `later` open out to midnight at that end.
 */
export function visibleRange(
  spans: readonly { start: number; end: number }[],
  now: number | null,
  open: { earlier?: boolean; later?: boolean } = {},
): { from: number; to: number } {
  const points = [...spans.flatMap((s) => [s.start, s.end]), ...(now === null ? [] : [now])];
  let from = RANGE_FROM;
  let to = RANGE_TO;
  if (points.length) {
    from = Math.min(RANGE_FROM, Math.floor((Math.min(...points) - 60) / 60) * 60);
    to = Math.max(RANGE_TO, Math.ceil((Math.max(...points) + 60) / 60) * 60);
  }
  from = Math.max(0, from);
  to = Math.min(DAY_MINUTES, to);
  return { from: open.earlier ? 0 : from, to: open.later ? DAY_MINUTES : to };
}

/** The segments of every item on the days shown, for `visibleRange`. */
export function rangeSpans(days: readonly LocalDate[], items: readonly ShownItem[], timeZone: string) {
  return items.filter(drawn).flatMap((item) => days.flatMap((d) => segmentOn(item, d, timeZone) ?? []));
}

/**
 * How tall an hour is drawn to fit `available` pixels with the range in them: as tall as fits up to a
 * ceiling, never under `MIN_HOUR_PX`; under that the grid scrolls instead.
 */
export function fitHourPx(hours: number, available: number | null): number {
  if (available === null || hours <= 0) return HOUR_PX;
  return Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, Math.floor(available / hours)));
}

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
 * Packs one day's segments side by side, as a calendar does: items that overlap in time (by their real
 * times: one that ends when the next starts does not overlap it, however short it is drawn) form a group that shares the column width; each takes the first
 * column free at its start, and widens over the columns to its right that nothing in its way uses.
 */
export function packDay(segments: (Segment & { item: ShownItem })[], scale: Scale = FULL_DAY): Block[] {
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
      blocks.push({ ...rest, columns, span, top: yAt(p.start, scale), height: Math.max(MIN_BLOCK_PX, (p.end - p.start) * scale.ppm) });
    }
    group = [];
  };

  for (const seg of sorted) {
    const until = Math.max(seg.end, seg.start + 1);
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

export function nowLine(days: readonly LocalDate[], now: Date, timeZone: string, scale: Scale = FULL_DAY): NowLine | null {
  const day = days.indexOf(toLocalDate(now, timeZone));
  if (day < 0) return null;
  const minutes = localMinutes(now, days[day], timeZone);
  return { day, minutes, top: yAt(minutes, scale) };
}

/**
 * The minute the grid opens scrolled to: an hour and a half before now when today is shown, else the top
 * of the visible range (`from`, 07:00 when nothing is planned earlier), on a whole hour so the first hour
 * label reads whole. Never above the range.
 */
export function openMinute(now: NowLine | null, from?: number): number {
  if (!now) return from ?? OPEN_AT;
  return Math.max(from ?? 0, Math.floor((now.minutes - 90) / 60) * 60);
}

export type GridLayout = { columns: DayColumn[]; now: NowLine | null };

/** A span of days and their items as positioned blocks. Notes, dropped items and anything outside the span are left out. */
export function layoutGrid({
  days,
  items,
  timeZone,
  now,
  scale = FULL_DAY,
}: {
  days: readonly LocalDate[];
  items: readonly ShownItem[];
  timeZone: string;
  now: Date;
  scale?: Scale;
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
    return { date, anyTime, blocks: packDay(segments, scale) };
  });
  return { columns, now: nowLine(days, now, timeZone, scale) };
}

/** Left offset and width of a block inside its day column, as fractions of the column. */
export function blockBox(block: Pick<Block, "column" | "columns" | "span">): { left: number; width: number } {
  return { left: block.column / block.columns, width: block.span / block.columns };
}
