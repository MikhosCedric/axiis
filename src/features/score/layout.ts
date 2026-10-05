import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import type { TodayEntry, TodayView } from "@/features/today/model";
import { localMinutes } from "@/lib/dates";

export const DAY_MINUTES = 24 * 60;
export const HOUR_PX = 76;
export const PX_PER_MINUTE = HOUR_PX / 60;
export const ROW_PX = 64;
export const BEAM_BOX_PX = 25;
const STAFF_FOOT_PX = 20;
const RULE_PX = 1;
/** Gap kept between a label and the next beam in its sub-row. */
const LABEL_GAP_PX = 8;

/** Local wall-clock minutes from midnight of the day shown, `[start, end)`. */
export type Span = { start: number; end: number };
export type Axis = Span;

export const DEFAULT_AXIS: Axis = { start: 7 * 60, end: 20 * 60 };

/** Where a timed item sits on the day, clipped to the day. Null for anything without a time. */
export function spanOf(item: Item, date: LocalDate, timeZone: string): Span | null {
  const s = item.schedule;
  if (s.kind !== "timed") return null;
  const start = Math.max(0, localMinutes(s.start, date, timeZone));
  const end = Math.min(DAY_MINUTES, localMinutes(s.end, date, timeZone));
  return { start, end: Math.max(end, start) };
}

/** 07:00 to 20:00, widened to whole hours that hold every span and, on today, now. */
export function axisFor(spans: Span[], now: number | null): Axis {
  let start = DEFAULT_AXIS.start;
  let end = DEFAULT_AXIS.end;
  const marks = now === null ? spans : [...spans, { start: now, end: now + 1 }];
  for (const s of marks) {
    start = Math.min(start, Math.floor(s.start / 60) * 60);
    end = Math.max(end, Math.ceil(s.end / 60) * 60);
  }
  return { start: Math.max(0, start), end: Math.min(DAY_MINUTES, end) };
}

export const xAt = (axis: Axis, minutes: number) => (minutes - axis.start) * PX_PER_MINUTE;
export const minutesAt = (axis: Axis, x: number) => axis.start + x / PX_PER_MINUTE;
export const axisWidth = (axis: Axis) => xAt(axis, axis.end);

export function hourTicks(axis: Axis): number[] {
  const ticks: number[] = [];
  for (let m = axis.start; m < axis.end; m += 60) ticks.push(m);
  return ticks;
}

export type Packed<T> = { value: T; span: Span; row: number; free: number };

/**
 * Greedy interval packing: each span takes the first sub-row whose last span
 * has ended. `free` is the minutes from a span's start to the next start in
 * its sub-row (or the axis end), which is how far its label may run.
 */
export function packRows<T>(spans: { value: T; span: Span }[], axisEnd: number): { rows: number; placed: Packed<T>[] } {
  const sorted = [...spans].sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
  const rowEnds: number[] = [];
  const placed = sorted.map(({ value, span }) => {
    let row = rowEnds.findIndex((end) => end <= span.start);
    if (row < 0) row = rowEnds.push(0) - 1;
    // A zero-length span still occupies its instant.
    rowEnds[row] = Math.max(span.end, span.start + 1);
    return { value, span, row, free: 0 };
  });
  for (const p of placed) {
    const next = placed.find((q) => q !== p && q.row === p.row && q.span.start >= p.span.end);
    p.free = (next ? next.span.start : axisEnd) - p.span.start;
  }
  return { rows: Math.max(1, rowEnds.length), placed };
}

/** Label width in pixels for a beam with `free` minutes before its next neighbour. */
export const labelWidth = (free: number) => Math.max(0, free * PX_PER_MINUTE - LABEL_GAP_PX);

export type Beam = Packed<TodayEntry>;

export type Staff = {
  areaId: AreaId | null;
  name: string;
  rows: number;
  beams: Beam[];
  open: number;
  /** Pixel offset of the staff body from the top of the first staff. */
  top: number;
  height: number;
};

/** An item being dragged onto a staff, not yet saved. */
export type Pending = { itemId: ItemId; areaId: AreaId | null; span: Span };

export type ScoreLayout = {
  axis: Axis;
  staves: Staff[];
  /** Where the pending item would be drawn: the first free sub-row of its staff, which grows by one if none is free. */
  ghost: { staff: number; row: number } | null;
  /** Day-only items, shown in the Any time strip. */
  anyTime: TodayEntry[];
  waiting: TodayEntry[];
  /** Area order for moving a beam up and down, ending with the no-area staff. */
  areaOrder: (AreaId | null)[];
};

export const NO_AREA = "No area";

/** First sub-row where `span` overlaps no drawn beam, ignoring the item being moved. */
export function freeRow(beams: Beam[], span: Span, ignore: ItemId): number {
  const taken = new Set(
    beams
      .filter((b) => b.value.item.id !== ignore && b.span.start < span.end && span.start < b.span.end)
      .map((b) => b.row),
  );
  let row = 0;
  while (taken.has(row)) row += 1;
  return row;
}

export const staffHeight = (rows: number) => rows * ROW_PX + STAFF_FOOT_PX;
/** Top of a beam's hit box inside its staff. */
export const beamTop = (row: number) => row * ROW_PX + ROW_PX - BEAM_BOX_PX;

export function layoutScore({
  view,
  areas,
  date,
  timeZone,
  now,
  pending = null,
}: {
  view: TodayView;
  areas: Area[];
  date: LocalDate;
  timeZone: string;
  /** Local minutes of now, or null when the day shown is not today. */
  now: number | null;
  pending?: Pending | null;
}): ScoreLayout {
  const known = new Set<AreaId>(areas.map((a) => a.id));
  const timed: { value: TodayEntry; span: Span }[] = [];
  const anyTime: TodayEntry[] = [];
  for (const entry of view.scheduled) {
    const span = spanOf(entry.item, date, timeZone);
    if (span) timed.push({ value: entry, span });
    else anyTime.push(entry);
  }
  const axis = axisFor(
    timed.map((t) => t.span),
    now,
  );
  const areaOf = (e: TodayEntry) => (e.item.areaId !== null && known.has(e.item.areaId) ? e.item.areaId : null);
  const needsNoArea = areas.length === 0 || timed.some((t) => areaOf(t.value) === null);
  const keys: { areaId: AreaId | null; name: string }[] = [
    ...areas.map((a) => ({ areaId: a.id, name: a.name })),
    ...(needsNoArea ? [{ areaId: null, name: NO_AREA }] : []),
  ];

  let top = 0;
  let ghost: ScoreLayout["ghost"] = null;
  const staves = keys.map(({ areaId, name }, index) => {
    const mine = timed.filter((t) => areaOf(t.value) === areaId);
    const packed = packRows(mine, axis.end);
    let rows = packed.rows;
    const placed = packed.placed;
    if (pending && pending.areaId === areaId) {
      ghost = { staff: index, row: freeRow(placed, pending.span, pending.itemId) };
      rows = Math.max(rows, ghost.row + 1);
    }
    const staff: Staff = {
      areaId,
      name,
      rows,
      beams: placed,
      open: mine.filter((t) => t.value.state !== "done").length,
      top,
      height: staffHeight(rows),
    };
    top += staff.height + RULE_PX;
    return staff;
  });

  return { axis, staves, ghost, anyTime, waiting: view.waiting, areaOrder: [...areas.map((a) => a.id), null] };
}

/** Index of the staff under a y offset measured from the top of the first staff, or -1. */
export function staffAt(staves: Pick<Staff, "top" | "height">[], y: number): number {
  return staves.findIndex((s) => y >= s.top && y < s.top + s.height + RULE_PX);
}
