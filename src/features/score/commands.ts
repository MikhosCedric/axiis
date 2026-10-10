import { z } from "zod";
import { idSchema, planDateSchema, type AreaId, type Schedule } from "@/domain/item";
import { inRange } from "@/lib/dates";
import { parseItemKey } from "@/domain/item-key";
import { materialize } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import type { ActionResult } from "@/features/today/commands";

const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unscheduled") }),
  z.object({ kind: z.literal("day"), on: planDateSchema }),
  z
    .object({ kind: z.literal("timed"), start: z.date(), end: z.date() })
    // A day is at most 25 hours, so nothing the Score draws is longer.
    .refine((s) => s.end > s.start && s.end.getTime() - s.start.getTime() <= 25 * 3_600_000)
    .refine((s) => inRange(s.start) && inRange(s.end)),
]);

const placementSchema = z.object({
  schedule: scheduleSchema,
  areaId: idSchema.nullable().optional(),
});

export const PLACE_FAILED = "That change did not save, so it is back where it was. Try again.";
const NOT_FOUND = "That item could not be found.";

/** Save where an item sits: its schedule and, when given, its area. */
export async function placeItem(repo: ItemsRepo, rawKey: unknown, rawPlacement: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: NOT_FOUND };
  const placement = placementSchema.safeParse(rawPlacement);
  if (!placement.success) return { ok: false, error: PLACE_FAILED };
  const { schedule, areaId } = placement.data;
  try {
    const id = key.kind === "item" ? key.id : (await materialize(repo, key, timeZone))?.id;
    if (!id) return { ok: false, error: NOT_FOUND };
    await repo.update(id, {
      schedule: schedule as Schedule,
      ...(areaId === undefined ? {} : { areaId: areaId as AreaId | null }),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: PLACE_FAILED };
  }
}
