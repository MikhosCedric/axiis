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

/** Most items one read of the Due page returns. */
export const DUE_LIMIT = 200;
/** Most items one read of what is left over from earlier days returns. */
export const BEHIND_LIMIT = 50;
/** Most waiting items (no day) one day read returns. */
export const WAITING_LIMIT = 200;
/**
 * Most scheduled items one read of several days returns. Kept under
 * PostgREST's own row cap (1000 on Supabase), so the cap never cuts a read
 * short without the app knowing.
 */
export const RANGE_LIMIT = 500;

export type ChildCount = { total: number; done: number };

/**
 * Persistence boundary for items. Callers speak domain types; the
 * implementation owns row mapping and error translation.
 */
export interface ItemsRepo {
  listAreas(): Promise<Area[]>;
  /**
   * Whether the account has ever stored an item of any type or status, soft-deleted
   * ones included. One row is read at most.
   */
  hasAnyItem(): Promise<boolean>;
  /**
   * Items on a day (timed in range, or day-only on the date) plus the waiting
   * ones: top-level items with no schedule, notes excepted, that are open or
   * were done inside the range. Waiting ones come newest first, at most
   * `WAITING_LIMIT`. Soft-deleted rows are excluded. Unscheduled subtasks are
   * not returned: they live under their parent. A subtask with its own
   * schedule is returned in `scheduled` like any other item.
   */
  listForDay(range: DayRange): Promise<{ scheduled: Item[]; unscheduled: Item[] }>;
  /**
   * How many stored items `listForDay(range)` would show open, by area: open,
   * not notes, not series, with an area, and timed in the range, day-only on
   * the date, or top-level with no schedule. Areas with none are absent. Every
   * row is counted, past any cap.
   */
  openCountByArea(range: DayRange): Promise<Record<string, number>>;
  /**
   * Scheduled items across several days: timed in `[from, to)` or day-only in
   * `[fromDate, toDate)`. Top-level and subtasks alike, soft-deleted excluded,
   * at most `RANGE_LIMIT`: timed ones by start, then day-only ones by date.
   */
  listRange(range: SpanRange): Promise<Item[]>;
  /**
   * Live series, at most `MAX_SERIES`, oldest first, without their body, as
   * every list read is: storing an occurrence reads its series whole with
   * `get`. `listForDay` and
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
  /**
   * Live top-level tasks and checklists with a due date, not repeating and not
   * dropped, soonest due first, at most `DUE_LIMIT`. Open ones, plus ones done
   * at or after `doneSince`, so a mistaken tick can be undone.
   */
  listDue(doneSince: Date): Promise<Item[]>;
  /**
   * Live items due on a date in `[fromDate, toDate)` that are not notes, not
   * series and not dropped, open or done, by due date, at most `RANGE_LIMIT`.
   */
  listDueIn(fromDate: LocalDate, toDate: LocalDate): Promise<Item[]>;
  /**
   * Open top-level tasks and checklists planned for a day before `range.date`
   * (a day, or a time that began before `range.from`), not repeating, oldest
   * first, at most `BEHIND_LIMIT`.
   */
  listBehind(range: DayRange): Promise<Item[]>;
  /**
   * Live overrides whose `originalOn` is in `[fromDate, toDate)`, skipped ones
   * included, of one series when given, by date. Every one: callers rewrite or
   * subtract them, so a short read would be wrong rather than incomplete.
   */
  listOverrides(fromDate: LocalDate, toDate: LocalDate, seriesId?: ItemId): Promise<Item[]>;
  /** Live children of one parent, ordered by position then creation. */
  listChildren(parentId: ItemId): Promise<Item[]>;
  /** Live child totals and done counts, keyed by parent id, counting every child. Parents with no children are absent. */
  childCounts(parentIds: ItemId[]): Promise<Record<string, ChildCount>>;
  get(id: ItemId): Promise<Item | null>;
  create(input: NewItem): Promise<Item>;
  update(id: ItemId, patch: ItemPatch): Promise<Item>;
  softDelete(id: ItemId): Promise<void>;
  /**
   * Hard-deletes up to 500 of the account's items soft-deleted more than 30
   * days ago (`purge_deleted_items`, migration 0008), so an account at its
   * item cap can free room. Overrides of a purged series stay, detached.
   */
  purgeDeleted(): Promise<void>;

  /**
   * Every tag, with how many open live items carry it. Unordered. Two reads:
   * the tags, and one count per tag from `tag_open_counts` (migration 0008),
   * so its size follows the number of tags, not of tagged items. Limits and
   * name rules live in the tag commands.
   */
  listTags(): Promise<TagSummary[]>;
  /** Every tag, without counts. One read of the tags table, which the commands keep to `TAGS_PER_USER` rows. Unordered. */
  listTagNames(): Promise<Tag[]>;
  /** Every tag on each item, keyed by item id. Items with none are absent. */
  tagsForItems(ids: ItemId[]): Promise<Record<string, Tag[]>>;
  /** Live items carrying a tag, open first, then done, newest first, at most `TAGGED_LIMIT`. Dropped ones are left out. */
  listTagged(tagId: TagId): Promise<Item[]>;
  /**
   * Puts the tags on the item, making each first when none has its name in
   * any case, in a fixed number of requests however many there are. Returns
   * the tags in the order named, one per distinct name. Running it again
   * changes nothing.
   */
  addTags(itemId: ItemId, names: readonly TagName[]): Promise<Tag[]>;
  /** Takes a tag off an item. A tag that is not on it counts as taken off. */
  removeTag(itemId: ItemId, tagId: TagId): Promise<void>;
  renameTag(tagId: TagId, name: TagName): Promise<Tag>;
  /** Deletes the tag and takes it off every item. The items stay as they are. A tag already gone counts as deleted. */
  deleteTag(tagId: TagId): Promise<void>;
}
