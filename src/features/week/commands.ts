import { z } from "zod";
import { planDateSchema } from "@/domain/item";
import { parseItemKey } from "@/domain/item-key";
import { materialize } from "@/lib/items/occurrences";
import type { ActionResult } from "@/features/today/commands";
import { DATE_RANGE_ERROR, outOfRange } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import { moveTo } from "./model";

const destinationSchema = z.union([z.literal("tray"), planDateSchema]);

export const MOVE_FAILED = "That move did not save, so it is back where it was. Try again.";
const NOT_FOUND = "That item could not be found.";

/**
 * Send an item to another day, or back to the tray. Only the id and the
 * destination come from the client; the new schedule is worked out here from
 * the stored item, so a timed item keeps its own clock and length.
 */
export async function moveItem(repo: ItemsRepo, rawKey: unknown, rawTo: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: NOT_FOUND };
  const to = destinationSchema.safeParse(rawTo);
  if (!to.success) return { ok: false, error: outOfRange(rawTo) ? DATE_RANGE_ERROR : MOVE_FAILED };
  try {
    const item = key.kind === "item" ? await repo.get(key.id) : await materialize(repo, key, timeZone);
    if (!item || item.type === "note") return { ok: false, error: NOT_FOUND };
    await repo.update(item.id, moveTo(item, to.data, timeZone));
    return { ok: true };
  } catch {
    return { ok: false, error: MOVE_FAILED };
  }
}
