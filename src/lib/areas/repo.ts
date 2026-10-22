import type { AreaColor } from "@/domain/area-color";
import type { Area, AreaId } from "@/domain/item";

/**
 * Persistence boundary for the user's areas. Name rules and limits live in the
 * account commands; this port only stores what it is given.
 */
export interface AreasRepo {
  /** Live areas, ordered by position. */
  list(): Promise<Area[]>;
  /** Appends a live area after the last one. */
  create(name: string): Promise<Area>;
  rename(id: AreaId, name: string): Promise<Area>;
  /** Null clears it back to None. */
  setColor(id: AreaId, color: AreaColor | null): Promise<Area>;
  /** Sets `deleted_at`. Items keep their `area_id` and show under "No area". */
  softDelete(id: AreaId): Promise<void>;
  /** Gives each listed area the position of its index. Safe to run again after a partial failure. */
  reorder(ids: AreaId[]): Promise<void>;
}
