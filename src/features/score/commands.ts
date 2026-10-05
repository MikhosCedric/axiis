import { z } from "zod";
import { idSchema, localDateSchema, type AreaId, type ItemId, type Schedule } from "@/domain/item";
import type { ItemsRepo } from "@/lib/items/repo";
import type { ActionResult } from "@/features/today/commands";

const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unscheduled") }),
  z.object({ kind: z.literal("day"), on: localDateSchema }),
  z
    .object({ kind: z.literal("timed"), start: z.date(), end: z.date() })
    // A day is at most 25 hours, so nothing the Score draws is longer.
    .refine((s) => s.end > s.start && s.end.getTime() - s.start.getTime() <= 25 * 3_600_000),
]);

const placementSchema = z.object({
  schedule: scheduleSchema,
  areaId: idSchema.nullable().optional(),
});

export const PLACE_FAILED = "That change did not save, so it is back where it was. Try again.";

/** Save where an item sits: its schedule and, when given, its area. */
export async function placeItem(repo: ItemsRepo, rawId: unknown, rawPlacement: unknown): Promise<ActionResult> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "That item could not be found." };
  const placement = placementSchema.safeParse(rawPlacement);
  if (!placement.success) return { ok: false, error: PLACE_FAILED };
  const { schedule, areaId } = placement.data;
  try {
    await repo.update(id.data as ItemId, {
      schedule: schedule as Schedule,
      ...(areaId === undefined ? {} : { areaId: areaId as AreaId | null }),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: PLACE_FAILED };
  }
}
