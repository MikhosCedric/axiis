import { z } from "zod";
import { idSchema, type ItemId, type LocalDate } from "@/domain/item";
import type { ActionResult } from "@/features/today/commands";
import { parseLocalDate } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import { moveTo } from "./model";

const destinationSchema = z.union([
  z.literal("tray"),
  z
    .string()
    .refine((raw) => parseLocalDate(raw) !== null)
    .transform((raw) => raw as LocalDate),
]);

export const MOVE_FAILED = "That move did not save, so it is back where it was. Try again.";
const NOT_FOUND = "That item could not be found.";

/**
 * Send an item to another day, or back to the tray. Only the id and the
 * destination come from the client; the new schedule is worked out here from
 * the stored item, so a timed item keeps its own clock and length.
 */
export async function moveItem(repo: ItemsRepo, rawId: unknown, rawTo: unknown, timeZone: string): Promise<ActionResult> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: NOT_FOUND };
  const to = destinationSchema.safeParse(rawTo);
  if (!to.success) return { ok: false, error: MOVE_FAILED };
  try {
    const item = await repo.get(id.data as ItemId);
    if (!item || item.type === "note") return { ok: false, error: NOT_FOUND };
    await repo.update(item.id, moveTo(item, to.data, timeZone));
    return { ok: true };
  } catch {
    return { ok: false, error: MOVE_FAILED };
  }
}
