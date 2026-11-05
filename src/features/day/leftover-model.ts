import type { ItemId, ItemType } from "@/domain/item";
import { BEHIND_LIMIT } from "@/lib/items/repo";

/** One item planned for an earlier day that is still open. */
export type LeftoverRow = { id: ItemId; type: ItemType; title: string; planned: string };

export type LeftoverData = {
  /** The first few, oldest first. */
  rows: LeftoverRow[];
  /** How many in all, `BEHIND_LIMIT` at most. */
  total: number;
  /** Only one area's are shown, so moving them all at once is not offered. */
  filtered: boolean;
};

/** How many rows the strip names; the rest are counted. */
export const LEFTOVER_SHOWN = 5;

export function leftoverHeading(total: number): string {
  const many = total >= BEHIND_LIMIT ? `${BEHIND_LIMIT}+` : String(total);
  return total === 1 ? "1 thing from an earlier day is still open" : `${many} things from earlier days are still open`;
}

/** "Planned Friday 10 January 2020" for the eye: "Fri 10 Jan 2020". The full words stay for a screen reader. */
export function shortPlanned(planned: string): string {
  let out = planned.replace(/^Planned /, "");
  out = out.replace(/\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/, (_, d: string) => d.slice(0, 3));
  out = out.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/, (m) => m.slice(0, 3));
  return out;
}
