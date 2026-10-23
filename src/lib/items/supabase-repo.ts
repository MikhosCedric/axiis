import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AREA_COLORS, type AreaColor } from "@/domain/area-color";
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
import {
  BEHIND_LIMIT,
  DUE_LIMIT,
  INBOX_LIMIT,
  LISTS_LIMIT,
  MAX_SERIES,
  RANGE_LIMIT,
  TAGGED_LIMIT,
  WAITING_LIMIT,
  type ChildCount,
  type ItemsRepo,
} from "./repo";

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };
type CountedResult = QueryResult & { count: number | null };

export class ItemsRepoError extends Error {
  override name = "ItemsRepoError";
}

function unwrap<T>(operation: string, { data, error }: QueryResult, parse: (raw: unknown) => T): T {
  if (error) throw new ItemsRepoError(`items.${operation} failed: ${error.message}`, { cause: error });
  return parse(data);
}

/**
 * Every row a read matches. PostgREST answers at most its `max-rows` (1000 on
 * Supabase) and says nothing when it stops early, so the first page asks for
 * the total, and the rest are read in parallel in pages the size the server
 * actually returned. `read` must order by a unique key, so pages do not overlap.
 */
async function readAll<T>(
  operation: string,
  read: (from: number, to: number) => PromiseLike<CountedResult>,
  parse: (raw: unknown) => T[],
): Promise<T[]> {
  const first = await read(0, COUNT_PAGE - 1);
  const rows = unwrap(operation, first, parse);
  const total = first.count ?? rows.length;
  const step = rows.length;
  if (step === 0 || total <= step) return rows;
  const starts = Array.from({ length: Math.ceil((total - step) / step) }, (_, i) => step * (i + 1));
  const pages = await Promise.all(starts.map(async (from) => unwrap(operation, await read(from, from + step - 1), parse)));
  return rows.concat(...pages);
}

const rowList = z.array(z.unknown());
const itemList = (raw: unknown) => rowList.parse(raw).map(itemFromRow);
const childRow = z.object({ parent_id: z.uuid(), status: z.enum(ITEM_STATUSES) });

/** `color` needs migration 0011; deploy after it is applied, or every tag read fails. */
const TAG_COLUMNS = "id,name,color";
const tagRow = z
  .object({ id: z.uuid(), name: z.string(), color: z.enum(AREA_COLORS).nullable() })
  .transform((r): Tag => ({ id: r.id as TagId, name: r.name as TagName, color: r.color }));
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

  async hasAnyItem(): Promise<boolean> {
    const result = await this.db.from("items").select("id").limit(1);
    return unwrap("hasAnyItem", result, (raw) => rowList.parse(raw).length > 0);
  }

  /** Items that are not series. A series is drawn through its expanded occurrences instead. */
  private single() {
    return this.items().is("rrule", null);
  }

  async listForDay(range: DayRange): Promise<{ scheduled: Item[]; unscheduled: Item[] }> {
    const [from, to] = [range.from.toISOString(), range.to.toISOString()];
    const [timed, dayOnly, unscheduled] = await Promise.all([
      this.single().gte("start_at", from).lt("start_at", to).order("start_at"),
      this.single().eq("scheduled_on", range.date).order("position"),
      this.items()
        .is("start_at", null)
        .is("scheduled_on", null)
        .is("parent_id", null)
        .neq("type", "note")
        .or(`status.eq.open,and(status.eq.done,completed_at.gte.${from},completed_at.lt.${to})`)
        .order("created_at", { ascending: false })
        .limit(WAITING_LIMIT),
    ]);
    return {
      scheduled: [...unwrap("listForDay", timed, itemList), ...unwrap("listForDay", dayOnly, itemList)],
      unscheduled: unwrap("listForDay", unscheduled, itemList),
    };
  }

  async openCountByArea(range: DayRange): Promise<Record<string, number>> {
    const timed = `and(start_at.gte.${range.from.toISOString()},start_at.lt.${range.to.toISOString()})`;
    const waiting = "and(start_at.is.null,scheduled_on.is.null,parent_id.is.null)";
    const rows = await readAll(
      "openCountByArea",
      (from, to) =>
        this.db
          .from("items")
          .select("area_id", { count: "exact" })
          .is("deleted_at", null)
          .is("rrule", null)
          .eq("status", "open")
          .neq("type", "note")
          .not("area_id", "is", null)
          .or(`${timed},scheduled_on.eq.${range.date},${waiting}`)
          .order("id")
          .range(from, to),
      (raw) => z.array(z.object({ area_id: z.uuid() })).parse(raw),
    );
    const counts: Record<string, number> = {};
    for (const { area_id } of rows) counts[area_id] = (counts[area_id] ?? 0) + 1;
    return counts;
  }

  async listRange(range: SpanRange): Promise<Item[]> {
    const timed = `and(start_at.gte.${range.from.toISOString()},start_at.lt.${range.to.toISOString()})`;
    const dayOnly = `and(scheduled_on.gte.${range.fromDate},scheduled_on.lt.${range.toDate})`;
    const result = await this.single()
      .or(`${timed},${dayOnly}`)
      .order("start_at", { nullsFirst: false })
      .order("scheduled_on")
      .order("position")
      .limit(RANGE_LIMIT);
    return unwrap("listRange", result, itemList);
  }

  async listSeries(): Promise<Item[]> {
    const result = await this.items().not("rrule", "is", null).order("created_at").limit(MAX_SERIES);
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

  async listDueIn(fromDate: LocalDate, toDate: LocalDate): Promise<Item[]> {
    const result = await this.single()
      .gte("due_on", fromDate)
      .lt("due_on", toDate)
      .neq("type", "note")
      .neq("status", "dropped")
      .order("due_on")
      .order("created_at")
      .limit(RANGE_LIMIT);
    return unwrap("listDueIn", result, itemList);
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
    return readAll(
      "listOverrides",
      (from, to) => {
        let query = this.db
          .from("items")
          .select(LIST_COLUMNS, { count: "exact" })
          .is("deleted_at", null)
          .not("series_id", "is", null)
          .gte("original_on", fromDate)
          .lt("original_on", toDate);
        if (seriesId) query = query.eq("series_id", seriesId);
        return query.order("original_on").order("id").range(from, to);
      },
      itemList,
    );
  }

  async listChildren(parentId: ItemId): Promise<Item[]> {
    const result = await this.items().eq("parent_id", parentId).order("position").order("created_at");
    return unwrap("listChildren", result, itemList);
  }

  async childCounts(parentIds: ItemId[]): Promise<Record<string, ChildCount>> {
    if (parentIds.length === 0) return {};
    const rows = await readAll(
      "childCounts",
      (from, to) =>
        this.db
          .from("items")
          .select("parent_id,status", { count: "exact" })
          .in("parent_id", parentIds)
          .is("deleted_at", null)
          .order("id")
          .range(from, to),
      (raw) => z.array(childRow).parse(raw),
    );
    const counts: Record<string, ChildCount> = {};
    for (const row of rows) {
      const c = (counts[row.parent_id] ??= { total: 0, done: 0 });
      c.total += 1;
      if (row.status === "done") c.done += 1;
    }
    return counts;
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

  async purgeDeleted(): Promise<void> {
    unwrap("purgeDeleted", await this.db.rpc("purge_deleted_items"), () => undefined);
  }

  private async allTags(): Promise<Tag[]> {
    return unwrap("listTags", await this.db.from("tags").select(TAG_COLUMNS), tagList);
  }

  /** Open counts per tag id, one row per tag with any (`tag_open_counts`, migration 0008), so one request is complete. */
  private async openCounts(): Promise<Map<string, number>> {
    const rows = unwrap("listTags", await this.db.rpc("tag_open_counts"), (raw) =>
      z.array(z.object({ tag_id: z.uuid(), open: z.number().int() })).parse(raw),
    );
    return new Map(rows.map((r) => [r.tag_id, r.open]));
  }

  async listTags(): Promise<TagSummary[]> {
    const [tags, counts] = await Promise.all([this.allTags(), this.openCounts()]);
    return tags.map((t) => ({ ...t, open: counts.get(t.id) ?? 0 }));
  }

  async tagsForItems(ids: ItemId[]): Promise<Record<string, Tag[]>> {
    if (ids.length === 0) return {};
    const rows = await readAll(
      "tagsForItems",
      (from, to) =>
        this.db
          .from("item_tags")
          .select(`item_id,tags!inner(${TAG_COLUMNS})`, { count: "exact" })
          .in("item_id", ids)
          .order("item_id")
          .order("tag_id")
          .range(from, to),
      (raw) => z.array(itemTagRow).parse(raw),
    );
    const byItem: Record<string, Tag[]> = {};
    for (const row of rows) (byItem[row.item_id] ??= []).push(row.tags);
    return byItem;
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

  async listTagNames(): Promise<Tag[]> {
    return this.allTags();
  }

  async addTags(itemId: ItemId, names: readonly TagName[]): Promise<Tag[]> {
    const wanted = names.filter((n, i) => names.findIndex((m) => sameTag(m, n)) === i);
    if (wanted.length === 0) return [];
    const find = (known: Tag[]) => wanted.map((n) => known.find((t) => sameTag(t.name, n)) ?? null);
    let tags = find(await this.allTags());
    const missing = wanted.filter((_, i) => !tags[i]);
    if (missing.length > 0) {
      const made = await this.db.from("tags").insert(missing.map((name) => ({ name }))).select(TAG_COLUMNS);
      // Another request made one of them first: the unique index on lower(name) refused the whole insert, so read theirs and make the rest.
      if (made.error?.code === UNIQUE_VIOLATION) {
        tags = find(await this.allTags());
        const rest = wanted.filter((_, i) => !tags[i]);
        if (rest.length > 0) {
          const again = await this.db.from("tags").insert(rest.map((name) => ({ name }))).select(TAG_COLUMNS);
          tags = find([...tags.filter((t) => t !== null), ...unwrap("addTags", again, tagList)]);
        }
      } else {
        tags = find([...tags.filter((t) => t !== null), ...unwrap("addTags", made, tagList)]);
      }
    }
    const found = tags.filter((t) => t !== null);
    if (found.length !== wanted.length) throw new ItemsRepoError("items.addTags failed: a tag was not there after it was made");
    const linked = await this.db.from("item_tags").upsert(
      found.map((t) => ({ item_id: itemId, tag_id: t.id })),
      { onConflict: "item_id,tag_id", ignoreDuplicates: true },
    );
    unwrap("addTags", linked, () => undefined);
    return found;
  }

  async removeTag(itemId: ItemId, tagId: TagId): Promise<void> {
    unwrap("removeTag", await this.db.from("item_tags").delete().eq("item_id", itemId).eq("tag_id", tagId), () => undefined);
  }

  async renameTag(tagId: TagId, name: TagName): Promise<Tag> {
    const result = await this.db.from("tags").update({ name }).eq("id", tagId).select(TAG_COLUMNS).single();
    return unwrap("renameTag", result, tagRow.parse);
  }

  async setTagColor(tagId: TagId, color: AreaColor | null): Promise<Tag> {
    const result = await this.db.from("tags").update({ color }).eq("id", tagId).select(TAG_COLUMNS).single();
    return unwrap("setTagColor", result, tagRow.parse);
  }

  async deleteTag(tagId: TagId): Promise<void> {
    unwrap("deleteTag", await this.db.from("tags").delete().eq("id", tagId), () => undefined);
  }
}
