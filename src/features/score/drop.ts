import type { AreaId, Schedule, ShownItem } from "@/domain/item";
import { SNAP_MINUTES } from "./snap";

/** What a gesture changes about an item: its schedule and, when given, its area. */
export type Placement = { schedule: Schedule; areaId?: AreaId | null };

export const DEFAULT_MINUTES = 30;
export const MIN_MINUTES = SNAP_MINUTES;

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
