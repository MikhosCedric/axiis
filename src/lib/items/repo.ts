import type { Area, DayRange, Item, ItemId, ItemPatch, NewItem } from "@/domain/item";

/**
 * Persistence boundary for items. Callers speak domain types; the
 * implementation owns row mapping and error translation.
 */
export interface ItemsRepo {
  listAreas(): Promise<Area[]>;
  /** Items on a day (timed in range, or day-only on the date) plus every item with no schedule. Soft-deleted rows are excluded. */
  listForDay(range: DayRange): Promise<{ scheduled: Item[]; unscheduled: Item[] }>;
  get(id: ItemId): Promise<Item | null>;
  create(input: NewItem): Promise<Item>;
  update(id: ItemId, patch: ItemPatch): Promise<Item>;
  softDelete(id: ItemId): Promise<void>;
}
