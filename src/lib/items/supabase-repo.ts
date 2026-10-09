import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ITEM_STATUSES,
  type Area,
  type DayRange,
  type Item,
  type ItemId,
  type ItemPatch,
  type LocalDate,
  type NewItem,
  type SpanRange,
} from "@/domain/item";
import { sameTag, type Tag, type TagId, type TagName, type TagSummary } from "@/domain/tag";
import { AREA_COLUMNS, ITEM_COLUMNS, LIST_COLUMNS, areaFromRow, itemFromRow, newItemToInsert, patchToUpdate } from "./mappers";
import { BEHIND_LIMIT, DUE_LIMIT, INBOX_LIMIT, LISTS_LIMIT, MAX_SERIES, TAGGED_LIMIT, type ChildCount, type ItemsRepo } from "./repo";

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

export class ItemsRepoError extends Error {
  override name = "ItemsRepoError";
}

function unwrap<T>(operation: string, { data, error }: QueryResult, parse: (raw: unknown) => T): T {
  if (error) throw new ItemsRepoError(`items.${operation} failed: ${error.message}`, { cause: error });
  return parse(data);
}

const rowList = z.array(z.unknown());
const itemList = (raw: unknown) => rowList.parse(raw).map(itemFromRow);
const childRow = z.object({ parent_id: z.uuid(), status: z.enum(ITEM_STATUSES) });

const TAG_COLUMNS = "id,name";
const tagRow = z.object({ id: z.uuid(), name: z.string() }).transform((r): Tag => ({ id: r.id as TagId, name: r.name as TagName }));
const tagList = (raw: unknown) => z.array(tagRow).parse(raw);
const itemTagRow = z.object({ item_id: z.uuid(), tags: tagRow });
const COUNT_PAGE = 1000;
const UNIQUE_VIOLATION = "23505";

/** Row Level Security scopes every query to the client's signed-in user, and `user_id` defaults to `auth.uid()` on insert. */
export class SupabaseItemsRepo implements ItemsRepo {
  constructor(private readonly db: SupabaseClient) {}

  private items(columns: string = LIST_COLUMNS) {
    return this.db.from("items").select(columns).is("deleted_at", null);
  }

  async listAreas(): Promise<Area[]> {
    const result = await this.db
      .from("areas")
      .select(AREA_COLUMNS)
      .is("deleted_at", null)
      .order("position");
    return unwrap("listAreas", result, (raw) => rowList.parse(raw).map(areaFromRow));
  }

  /** Items that are not series. A series is drawn through its expanded occurrences instead. */
  private single() {
    return this.items().is("rrule", null);
  }

  async listForDay(range: DayRange): Promise<{ scheduled: Item[]; unscheduled: Item[] }> {
    const [timed, dayOnly, unscheduled] = await Promise.all([
      this.single().gte("start_at", range.from.toISOString()).lt("start_at", range.to.toISOString()).order("start_at"),
      this.single().eq("scheduled_on", range.date).order("position"),
      this.items().is("start_at", null).is("scheduled_on", null).is("parent_id", null).neq("type", "note").order("position"),
    ]);
    return {
      scheduled: [...unwrap("listForDay", timed, itemList), ...unwrap("listForDay", dayOnly, itemList)],
      unscheduled: unwrap("listForDay", unscheduled, itemList),
    };
  }

  async listRange(range: SpanRange): Promise<Item[]> {
    const [timed, dayOnly] = await Promise.all([
      this.single().gte("start_at", range.from.toISOString()).lt("start_at", range.to.toISOString()).order("start_at"),
      this.single().gte("scheduled_on", range.fromDate).lt("scheduled_on", range.toDate).order("scheduled_on").order("position"),
    ]);
    return [...unwrap("listRange", timed, itemList), ...unwrap("listRange", dayOnly, itemList)];
  }

  async listSeries(): Promise<Item[]> {
    const result = await this.items(ITEM_COLUMNS).not("rrule", "is", null).order("created_at").limit(MAX_SERIES);
    return unwrap("listSeries", result, itemList);
  }

  async listInbox(): Promise<Item[]> {
    const result = await this.single()
      .is("start_at", null)
      .is("scheduled_on", null)
      .is("parent_id", null)
      .is("series_id", null)
      .eq("status", "open")
      .neq("type", "note")
      .order("created_at", { ascending: false })
      .limit(INBOX_LIMIT);
    return unwrap("listInbox", result, itemList);
  }

  async listChecklists(): Promise<Item[]> {
    const result = await this.items()
      .eq("type", "checklist")
      .is("parent_id", null)
      .is("series_id", null)
      .neq("status", "dropped")
      // The status enum is declared open, done, dropped, so this puts open first.
      .order("status")
      .order("created_at", { ascending: false })
      .limit(LISTS_LIMIT);
    return unwrap("listChecklists", result, itemList);
  }

  async listDue(doneSince: Date): Promise<Item[]> {
    const result = await this.single()
      .is("series_id", null)
      .is("parent_id", null)
      .not("due_on", "is", null)
      .neq("type", "note")
      .or(`status.eq.open,and(status.eq.done,completed_at.gte.${doneSince.toISOString()})`)
      .order("due_on")
      .order("created_at")
      .limit(DUE_LIMIT);
    return unwrap("listDue", result, itemList);
  }

  async listBehind(range: DayRange): Promise<Item[]> {
    const open = () =>
      this.single().is("series_id", null).is("parent_id", null).eq("status", "open").neq("type", "note");
    const [timed, dayOnly] = await Promise.all([
      open().lt("start_at", range.from.toISOString()).order("start_at").limit(BEHIND_LIMIT),
      open().lt("scheduled_on", range.date).order("scheduled_on").limit(BEHIND_LIMIT),
    ]);
    const plannedAt = (i: Item) => (i.schedule.kind === "timed" ? i.schedule.start.getTime() : Date.parse(`${i.schedule.kind === "day" ? i.schedule.on : range.date}T00:00:00Z`));
    return [...unwrap("listBehind", timed, itemList), ...unwrap("listBehind", dayOnly, itemList)]
      .sort((a, b) => plannedAt(a) - plannedAt(b))
      .slice(0, BEHIND_LIMIT);
  }

  async listOverrides(fromDate: LocalDate, toDate: LocalDate, seriesId?: ItemId): Promise<Item[]> {
    let query = this.items().not("series_id", "is", null).gte("original_on", fromDate).lt("original_on", toDate);
    if (seriesId) query = query.eq("series_id", seriesId);
    const result = await query.order("original_on");
    return unwrap("listOverrides", result, itemList);
  }

  async listChildren(parentId: ItemId): Promise<Item[]> {
    const result = await this.items().eq("parent_id", parentId).order("position").order("created_at");
    return unwrap("listChildren", result, itemList);
  }

  async childCounts(parentIds: ItemId[]): Promise<Record<string, ChildCount>> {
    if (parentIds.length === 0) return {};
    const result = await this.db
      .from("items")
      .select("parent_id,status")
      .in("parent_id", parentIds)
      .is("deleted_at", null);
    return unwrap("childCounts", result, (raw) => {
      const counts: Record<string, ChildCount> = {};
      for (const row of z.array(childRow).parse(raw)) {
        const c = (counts[row.parent_id] ??= { total: 0, done: 0 });
        c.total += 1;
        if (row.status === "done") c.done += 1;
      }
      return counts;
    });
  }

  async get(id: ItemId): Promise<Item | null> {
    const result = await this.items(ITEM_COLUMNS).eq("id", id).maybeSingle();
    return unwrap("get", result, (raw) => (raw === null ? null : itemFromRow(raw)));
  }

  async create(input: NewItem): Promise<Item> {
    const result = await this.db.from("items").insert(newItemToInsert(input)).select(ITEM_COLUMNS).single();
    return unwrap("create", result, itemFromRow);
  }

  async update(id: ItemId, patch: ItemPatch): Promise<Item> {
    const result = await this.db
      .from("items")
      .update(patchToUpdate(patch, new Date()))
      .eq("id", id)
      .is("deleted_at", null)
      .select(ITEM_COLUMNS)
      .single();
    return unwrap("update", result, itemFromRow);
  }

  async softDelete(id: ItemId): Promise<void> {
    const result = await this.db
      .from("items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    unwrap("softDelete", result, () => undefined);
  }

  private async allTags(): Promise<Tag[]> {
    return unwrap("listTags", await this.db.from("tags").select(TAG_COLUMNS), tagList);
  }

  /**
   * Open counts per tag id, from the links whose item is open and live. Read in
   * pages, advancing by the rows returned, so a server cap on rows per reply
   * cannot cut the count short.
   */
  private async openCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (let read = 0; ; ) {
      const result = await this.db
        .from("item_tags")
        .select("tag_id,items!inner(id)")
        .eq("items.status", "open")
        .is("items.deleted_at", null)
        .order("item_id")
        .order("tag_id")
        .range(read, read + COUNT_PAGE - 1);
      const page = unwrap("listTags", result, (raw) => z.array(z.object({ tag_id: z.uuid() })).parse(raw));
      if (page.length === 0) return counts;
      for (const { tag_id } of page) counts.set(tag_id, (counts.get(tag_id) ?? 0) + 1);
      read += page.length;
    }
  }

  async listTags(): Promise<TagSummary[]> {
    const [tags, counts] = await Promise.all([this.allTags(), this.openCounts()]);
    return tags.map((t) => ({ ...t, open: counts.get(t.id) ?? 0 }));
  }

  async tagsForItems(ids: ItemId[]): Promise<Record<string, Tag[]>> {
    if (ids.length === 0) return {};
    const result = await this.db.from("item_tags").select(`item_id,tags!inner(${TAG_COLUMNS})`).in("item_id", ids);
    return unwrap("tagsForItems", result, (raw) => {
      const byItem: Record<string, Tag[]> = {};
      for (const row of z.array(itemTagRow).parse(raw)) (byItem[row.item_id] ??= []).push(row.tags);
      return byItem;
    });
  }

  async listTagged(tagId: TagId): Promise<Item[]> {
    const result = await this.db
      .from("items")
      .select(`${LIST_COLUMNS},item_tags!inner(tag_id)`)
      .eq("item_tags.tag_id", tagId)
      .is("deleted_at", null)
      .neq("status", "dropped")
      // The status enum is declared open, done, dropped, so this puts open first.
      .order("status")
      .order("created_at", { ascending: false })
      .limit(TAGGED_LIMIT);
    return unwrap("listTagged", result, itemList);
  }

  async addTag(itemId: ItemId, name: TagName): Promise<Tag> {
    const named = async () => (await this.allTags()).find((t) => sameTag(t.name, name)) ?? null;
    let tag = await named();
    if (!tag) {
      const made = await this.db.from("tags").insert({ name }).select(TAG_COLUMNS).single();
      // Another request made the same tag first: the unique index on lower(name) refused this one, so use theirs.
      tag = made.error?.code === UNIQUE_VIOLATION ? await named() : unwrap("addTag", made, tagRow.parse);
      if (!tag) throw new ItemsRepoError(`items.addTag failed: no tag named ${name} after a clash`);
    }
    const linked = await this.db
      .from("item_tags")
      .upsert({ item_id: itemId, tag_id: tag.id }, { onConflict: "item_id,tag_id", ignoreDuplicates: true });
    unwrap("addTag", linked, () => undefined);
    return tag;
  }

  async removeTag(itemId: ItemId, tagId: TagId): Promise<void> {
    unwrap("removeTag", await this.db.from("item_tags").delete().eq("item_id", itemId).eq("tag_id", tagId), () => undefined);
  }

  async renameTag(tagId: TagId, name: TagName): Promise<Tag> {
    const result = await this.db.from("tags").update({ name }).eq("id", tagId).select(TAG_COLUMNS).single();
    return unwrap("renameTag", result, tagRow.parse);
  }

  async deleteTag(tagId: TagId): Promise<void> {
    unwrap("deleteTag", await this.db.from("tags").delete().eq("id", tagId), () => undefined);
  }
}
