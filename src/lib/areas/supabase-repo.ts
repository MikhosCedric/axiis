import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Area, AreaId } from "@/domain/item";
import { AREA_COLUMNS, areaFromRow } from "@/lib/items/mappers";
import type { AreasRepo } from "./repo";

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

export class AreasRepoError extends Error {
  override name = "AreasRepoError";
}

function unwrap<T>(operation: string, { data, error }: QueryResult, parse: (raw: unknown) => T): T {
  if (error) throw new AreasRepoError(`areas.${operation} failed: ${error.message}`, { cause: error });
  return parse(data);
}

const areaList = (raw: unknown) => z.array(z.unknown()).parse(raw).map(areaFromRow);

/** Row Level Security scopes every query to the client's signed-in user, and `user_id` defaults to `auth.uid()` on insert. */
export class SupabaseAreasRepo implements AreasRepo {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<Area[]> {
    const result = await this.db.from("areas").select(AREA_COLUMNS).is("deleted_at", null).order("position");
    return unwrap("list", result, areaList);
  }

  async create(name: string): Promise<Area> {
    const last = await this.db
      .from("areas")
      .select("position")
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1);
    const position = unwrap("create", last, (raw) => z.array(z.object({ position: z.number() })).parse(raw)[0]?.position ?? 0) + 1;
    const result = await this.db.from("areas").insert({ name, position }).select(AREA_COLUMNS).single();
    return unwrap("create", result, areaFromRow);
  }

  async rename(id: AreaId, name: string): Promise<Area> {
    const result = await this.db
      .from("areas")
      .update({ name })
      .eq("id", id)
      .is("deleted_at", null)
      .select(AREA_COLUMNS)
      .single();
    return unwrap("rename", result, areaFromRow);
  }

  async softDelete(id: AreaId): Promise<void> {
    const result = await this.db
      .from("areas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    unwrap("softDelete", result, () => undefined);
  }

  async reorder(ids: AreaId[]): Promise<void> {
    const results = await Promise.all(
      ids.map((id, index) => this.db.from("areas").update({ position: index + 1 }).eq("id", id).is("deleted_at", null)),
    );
    for (const result of results) unwrap("reorder", result, () => undefined);
  }
}
