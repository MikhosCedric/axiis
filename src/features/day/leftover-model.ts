import type { ItemId, ItemType } from "@/domain/item";
import { BEHIND_LIMIT } from "@/lib/items/repo";

/** One item planned for an earlier day that is still open. */
export type LeftoverRow = { id: ItemId; type: ItemType; title: string; planned: string };

export type LeftoverData = {
  /** The first few, oldest first. */
  rows: LeftoverRow[];
  /** How many in all, `BEHIND_LIMIT` at most. */
  total: number;
};

/** How many rows the strip names; the rest are counted. */
export const LEFTOVER_SHOWN = 5;

export function leftoverHeading(total: number): string {
  const many = total >= BEHIND_LIMIT ? `${BEHIND_LIMIT}+` : String(total);
  return total === 1 ? "1 thing from an earlier day is still open" : `${many} things from earlier days are still open`;
}
