import type { Area, DayRange, Item, ItemId, ItemPatch, LocalDate, NewItem, SpanRange } from "@/domain/item";

/** Most live series one user can have read at once. */
export const MAX_SERIES = 200;

/** Most inbox items one read returns. */
export const INBOX_LIMIT = 200;

export type ChildCount = { total: number; done: number };

/**
 * Persistence boundary for items. Callers speak domain types; the
 * implementation owns row mapping and error translation.
 */
export interface ItemsRepo {
  listAreas(): Promise<Area[]>;
  /**
   * Items on a day (timed in range, or day-only on the date) plus every top-level item with no schedule.
   * Soft-deleted rows are excluded. Unscheduled subtasks are not returned: they live under their parent.
   * A subtask with its own schedule is returned in `scheduled` like any other item.
   */
  listForDay(range: DayRange): Promise<{ scheduled: Item[]; unscheduled: Item[] }>;
  /** Scheduled items across several days: timed in `[from, to)` or day-only in `[fromDate, toDate)`. Top-level and subtasks alike, soft-deleted excluded, ordered by time. */
  listRange(range: SpanRange): Promise<Item[]>;
  /**
   * Live series, at most `MAX_SERIES`, oldest first. `listForDay` and
   * `listRange` leave series out: their occurrences are expanded instead.
   */
  listSeries(): Promise<Item[]>;
  /**
   * The inbox: open top-level items with no schedule that are not notes and
   * belong to no series. At most `INBOX_LIMIT`, newest first.
   */
  listInbox(): Promise<Item[]>;
  /** Live overrides whose `originalOn` is in `[fromDate, toDate)`, skipped ones included, of one series when given. */
  listOverrides(fromDate: LocalDate, toDate: LocalDate, seriesId?: ItemId): Promise<Item[]>;
  /** Live children of one parent, ordered by position then creation. */
  listChildren(parentId: ItemId): Promise<Item[]>;
  /** Live child totals and done counts, keyed by parent id. Parents with no children are absent. */
  childCounts(parentIds: ItemId[]): Promise<Record<string, ChildCount>>;
  get(id: ItemId): Promise<Item | null>;
  create(input: NewItem): Promise<Item>;
  update(id: ItemId, patch: ItemPatch): Promise<Item>;
  softDelete(id: ItemId): Promise<void>;
}
