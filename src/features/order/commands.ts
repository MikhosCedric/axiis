import { z } from "zod";
import { idSchema, type Item, type ItemId } from "@/domain/item";
import type { ActionResult } from "@/features/today/commands";
import { planOrder, type OrderEnd } from "@/lib/items/order";
import { LISTS_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import { saveFailure } from "@/lib/quota";

const idsSchema = z.array(idSchema).min(1).max(LISTS_LIMIT);

const CHANGED = "That list has changed, so nothing moved. Try again.";
const NOT_SAVED = "That order did not save. Try again.";
const MISSING = "That item is not here any more.";

/**
 * Stores `ids` as the order of `current`, which is read in the order it is stored now. Every id must be one of
 * them, once. Rows the caller did not name (added while the move was on its way) stay where a new row goes.
 */
async function arrange(repo: ItemsRepo, current: Item[], ids: ItemId[], end: OrderEnd): Promise<ActionResult> {
  const byId = new Map(current.map((i) => [i.id, i]));
  if (new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) return { ok: false, error: CHANGED };
  const named = ids.map((id) => byId.get(id)!);
  const rest = current.filter((i) => !ids.includes(i.id));
  const wanted = end === "new-last" ? [...named, ...rest] : [...rest, ...named];
  const writes = planOrder(wanted, end);
  await Promise.all(writes.map((w) => repo.update(w.id as ItemId, { position: w.position })));
  return { ok: true };
}

async function attempt(work: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await work();
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
}

/** Puts the subtasks or checklist lines of one parent in the order given. Nothing else about them changes. */
export async function reorderChildren(repo: ItemsRepo, rawParentId: unknown, rawIds: unknown): Promise<ActionResult> {
  const parentId = idSchema.safeParse(rawParentId);
  if (!parentId.success) return { ok: false, error: MISSING };
  const ids = idsSchema.safeParse(rawIds);
  if (!ids.success) return { ok: false, error: CHANGED };
  return attempt(async () => arrange(repo, await repo.listChildren(parentId.data as ItemId), ids.data as ItemId[], "new-last"));
}

/**
 * Puts the checklists on the Lists page in the order given. Open ones still come before done ones whatever is
 * asked, since that is how the page reads them; the order holds inside each group.
 */
export async function reorderChecklists(repo: ItemsRepo, rawIds: unknown): Promise<ActionResult> {
  const ids = idsSchema.safeParse(rawIds);
  if (!ids.success) return { ok: false, error: CHANGED };
  return attempt(async () => arrange(repo, await repo.listChecklists(), ids.data as ItemId[], "new-first"));
}
