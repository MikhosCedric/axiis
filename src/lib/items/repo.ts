import type { Area, DayRange, Item, ItemId, ItemPatch, LocalDate, NewItem, SpanRange } from "@/domain/item";
import type { Tag, TagId, TagName, TagSummary } from "@/domain/tag";

/** Most live series one user can have read at once. */
export const MAX_SERIES = 200;

/** Most inbox items one read returns. */
export const INBOX_LIMIT = 200;

/** Most items one tag's list returns. */
export const TAGGED_LIMIT = 200;

/** Most checklists one read of the Lists page returns. */
export const LISTS_LIMIT = 200;

export type ChildCount = { total: number; done: number };

/**
 * Persistence boundary for items. Callers speak domain types; the
 * implementation owns row mapping and error translation.
 */
export interface ItemsRepo {
  listAreas(): Promise<Area[]>;
  /**
   * Items on a day (timed in range, or day-only on the date) plus every top-level item with no schedule, notes excepted.
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
  /**
   * Live top-level checklists, with or without a schedule, that are not
   * dropped. A repeating one comes once, as its series; overrides are left
   * out. Open first, then done, newest first, at most `LISTS_LIMIT`.
   */
  listChecklists(): Promise<Item[]>;
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

  /** Every tag, with how many open live items carry it. Unordered. Limits and name rules live in the tag commands. */
  listTags(): Promise<TagSummary[]>;
  /** The tags on each item, keyed by item id, in one read for any number of items. Items with none are absent. */
  tagsForItems(ids: ItemId[]): Promise<Record<string, Tag[]>>;
  /** Live items carrying a tag, open first, then done, newest first, at most `TAGGED_LIMIT`. Dropped ones are left out. */
  listTagged(tagId: TagId): Promise<Item[]>;
  /** Puts the tag on the item, making the tag first when none has this name in any case. Running it again changes nothing. */
  addTag(itemId: ItemId, name: TagName): Promise<Tag>;
  /** Takes a tag off an item. A tag that is not on it counts as taken off. */
  removeTag(itemId: ItemId, tagId: TagId): Promise<void>;
  renameTag(tagId: TagId, name: TagName): Promise<Tag>;
  /** Deletes the tag and takes it off every item. The items stay as they are. A tag already gone counts as deleted. */
  deleteTag(tagId: TagId): Promise<void>;
}
