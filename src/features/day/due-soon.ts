import type { Item, ItemId, ItemType, LocalDate } from "@/domain/item";
import { dueChip, dueWords } from "@/features/due/model";
import { keeps, NO_FILTER, type ViewFilter } from "@/features/filter/model";
import { displayTitle } from "@/features/notes/model";
import type { ItemsRepo } from "@/lib/items/repo";

/** One open item with a due date from today on, worded for a line in the Day's side column. */
export type DueSoonRow = {
  id: ItemId;
  type: ItemType;
  title: string;
  /** "Today", "Tomorrow", "Fri", "15 Jan": the eye's word. */
  chip: string;
  /** "Due Friday 20 November": the sentence for a screen reader. */
  words: string;
};

export type DueSoonData = {
  /** The soonest few. */
  rows: DueSoonRow[];
  /** How many open items are due from today on, in the read. */
  total: number;
};

/** How many rows the card names; the Due page has the rest. */
export const DUE_SOON_SHOWN = 4;

/**
 * The next due dates from today on: open, top-level items soonest first, in the filter's area when there is one.
 * Dates already behind us are the Due page's and the left-over strip's business, so none shows here.
 * Null when nothing is due. Under a tag filter nothing shows, since the read carries no tags.
 */
export function dueSoon(items: readonly Item[], today: LocalDate, filter: ViewFilter = NO_FILTER): DueSoonData | null {
  if (filter.tag) return null;
  const open = items
    .filter((i) => i.status === "open" && i.dueOn !== null && i.dueOn >= today && keeps(filter, i, undefined))
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : a.dueOn! > b.dueOn! ? 1 : 0));
  if (open.length === 0) return null;
  return {
    total: open.length,
    rows: open.slice(0, DUE_SOON_SHOWN).map((i) => ({
      id: i.id,
      type: i.type,
      title: displayTitle(i),
      chip: dueChip(i.dueOn!, today, false).text,
      words: dueWords(i.dueOn!, today, false),
    })),
  };
}

const DAY_MS = 86_400_000;

export async function loadDueSoon(repo: ItemsRepo, today: LocalDate, now: Date, filter: ViewFilter = NO_FILTER): Promise<DueSoonData | null> {
  return dueSoon(await repo.listDue(new Date(now.getTime() - DAY_MS)), today, filter);
}
