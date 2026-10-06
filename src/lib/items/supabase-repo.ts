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
import { AREA_COLUMNS, ITEM_COLUMNS, areaFromRow, itemFromRow, newItemToInsert, patchToUpdate } from "./mappers";
import { MAX_SERIES, type ChildCount, type ItemsRepo } from "./repo";

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

/** Row Level Security scopes every query to the client's signed-in user, and `user_id` defaults to `auth.uid()` on insert. */
export class SupabaseItemsRepo implements ItemsRepo {
  constructor(private readonly db: SupabaseClient) {}

  private items() {
    return this.db.from("items").select(ITEM_COLUMNS).is("deleted_at", null);
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
      this.items().is("start_at", null).is("scheduled_on", null).is("parent_id", null).order("position"),
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
    const result = await this.items().not("rrule", "is", null).order("created_at").limit(MAX_SERIES);
    return unwrap("listSeries", result, itemList);
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
    const result = await this.items().eq("id", id).maybeSingle();
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
}
