import type { AreaId, ShownItem, LocalDate, Schedule } from "@/domain/item";
import { instantAt } from "@/lib/dates";
import { DAY_MINUTES, spanOf, type Axis } from "./layout";
import { clamp, SNAP_MINUTES, snap } from "./snap";

/** What a gesture changes about an item: its schedule, and for a drop on a staff, its area. */
export type Placement = { schedule: Schedule; areaId?: AreaId | null };

export type DropContext = {
  date: LocalDate;
  timeZone: string;
  axis: Axis;
  /** Local minutes of now when the day shown is today, else null. */
  now: number | null;
};

export const DEFAULT_MINUTES = 30;
export const MIN_MINUTES = SNAP_MINUTES;
/** Where an item lands when it gets a time from the keyboard on a day that is not today. */
const KEYBOARD_DEFAULT_START = 9 * 60;

function timed(ctx: DropContext, start: number, end: number): Schedule {
  return { kind: "timed", start: instantAt(ctx.date, start, ctx.timeZone), end: instantAt(ctx.date, end, ctx.timeZone) };
}

/** Wall-clock length an item keeps when it moves: its own for a timed item, the default otherwise. */
function lengthOf(ctx: DropContext, item: ShownItem): number {
  const span = spanOf(item, ctx.date, ctx.timeZone);
  return span ? Math.max(MIN_MINUTES, span.end - span.start) : DEFAULT_MINUTES;
}

/**
 * Put `item` on the staff for `areaId`, starting near `start` (local minutes,
 * unsnapped). It keeps its length, snaps to the grid and stays inside the axis.
 */
export function placeAt(ctx: DropContext, item: ShownItem, areaId: AreaId | null, start: number): Placement {
  const { axis } = ctx;
  const length = Math.min(lengthOf(ctx, item), axis.end - axis.start);
  const from = clamp(snap(start), axis.start, axis.end - length);
  return { schedule: timed(ctx, from, from + length), areaId };
}

/** Move a timed item's end near `end`, keeping at least the minimum length and not passing the axis or midnight. */
export function resizeTo(ctx: DropContext, item: ShownItem, end: number): Placement | null {
  const span = spanOf(item, ctx.date, ctx.timeZone);
  if (!span) return null;
  const to = clamp(snap(end), span.start + MIN_MINUTES, Math.min(ctx.axis.end, DAY_MINUTES));
  return { schedule: timed(ctx, span.start, to) };
}

export const unschedule = (): Placement => ({ schedule: { kind: "unscheduled" } });

export const anyTime = (ctx: DropContext): Placement => ({ schedule: { kind: "day", on: ctx.date } });

/** Whether applying `placement` would change anything about `item`. */
export function changes(item: ShownItem, placement: Placement): boolean {
  if (placement.areaId !== undefined && placement.areaId !== item.areaId) return true;
  const a = item.schedule;
  const b = placement.schedule;
  if (a.kind === "timed" && b.kind === "timed") {
    return a.start.getTime() !== b.start.getTime() || a.end.getTime() !== b.end.getTime();
  }
  if (a.kind === "day" && b.kind === "day") return a.on !== b.on;
  return a.kind !== b.kind;
}

export type KeyPress = { key: string; shiftKey: boolean };

/**
 * The placement a key press asks for, or null when the key means nothing here
 * or would change nothing.
 * On a beam: arrows left and right move by a quarter hour, with Shift they
 * change the length; up and down change area; Backspace or Delete clears the time.
 * On an item without a time: up or down gives it one on its own area's staff.
 */
export function keyPlacement(ctx: DropContext, item: ShownItem, areaOrder: (AreaId | null)[], press: KeyPress): Placement | null {
  const span = spanOf(item, ctx.date, ctx.timeZone);
  const area = areaOrder.includes(item.areaId) ? item.areaId : null;
  let next: Placement | null = null;

  if (!span) {
    if (press.key !== "ArrowUp" && press.key !== "ArrowDown") return null;
    const start = ctx.now === null ? KEYBOARD_DEFAULT_START : Math.ceil(ctx.now / SNAP_MINUTES) * SNAP_MINUTES;
    next = placeAt(ctx, item, area, start);
  } else if (press.key === "ArrowLeft" || press.key === "ArrowRight") {
    const step = press.key === "ArrowRight" ? SNAP_MINUTES : -SNAP_MINUTES;
    next = press.shiftKey ? resizeTo(ctx, item, span.end + step) : placeAt(ctx, item, area, snap(span.start) + step);
  } else if (press.key === "ArrowUp" || press.key === "ArrowDown") {
    const i = areaOrder.indexOf(area) + (press.key === "ArrowDown" ? 1 : -1);
    if (i < 0 || i >= areaOrder.length) return null;
    next = { schedule: item.schedule, areaId: areaOrder[i] };
  } else if (press.key === "Backspace" || press.key === "Delete") {
    next = unschedule();
  }
  return next && changes(item, next) ? next : null;
}
