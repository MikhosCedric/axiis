import { z } from "zod";
import { idSchema, type ItemId } from "@/domain/item";
import { parseItemKey } from "@/domain/item-key";
import { byName, tagColors, type TagColors, type TagName } from "@/domain/tag";
import { byUse } from "@/features/tags/model";
import type { ActionResult } from "@/features/today/commands";
import { resolveKey } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import { saveFailure } from "@/lib/quota";

const MISSING = "That item is not here any more.";
const NOT_SAVED = "That change did not save. Try again.";

/** As many as one delete can take: an item and the subtasks it may hold, or a series and the one it was deleted from. */
const restoreSchema = z.array(idSchema).min(1).max(500);

/**
 * Undoes a delete: the items it took are live again, in the order given back
 * (a delete lists subtasks before their parent, so the parent returns first).
 * Running it again changes nothing.
 */
export async function restoreItems(repo: ItemsRepo, rawIds: unknown): Promise<ActionResult> {
  const ids = restoreSchema.safeParse(rawIds);
  if (!ids.success) return { ok: false, error: MISSING };
  try {
    for (const id of [...ids.data].reverse()) await repo.restore(id as ItemId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
}

export type DuplicateResult = { ok: true; id: ItemId } | { ok: false; error: string };

/**
 * Makes a copy of what is shown, as a one-off: the same type, title, body,
 * area, place in time, due date and tags, and the same subtasks, open. One
 * time a series happens is copied as that day, without storing it; a series'
 * own row is copied as its first time. A subtask's copy sits under the same
 * parent.
 */
export async function duplicateItem(repo: ItemsRepo, rawKey: unknown, timeZone: string): Promise<DuplicateResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING };
  try {
    const found = await resolveKey(repo, key, timeZone);
    if (!found) return { ok: false, error: MISSING };
    const source = found.item;
    const stored = found.kind === "stored" ? found.item : null;
    const owner =
      found.kind === "virtual" ? found.series.id : source.recurrence.kind === "override" ? source.recurrence.seriesId : (stored!.id as ItemId);
    const [children, tags] = await Promise.all([
      stored && stored.recurrence.kind !== "series" ? repo.listChildren(stored.id) : [],
      repo.tagsForItems([owner]),
    ]);
    const copy = await repo.create({
      type: source.type,
      title: source.title,
      body: source.body,
      areaId: source.areaId,
      parentId: source.parentId,
      schedule: source.schedule,
      dueOn: source.dueOn,
    });
    for (const child of children) {
      await repo.create({ type: child.type, title: child.title, parentId: copy.id, areaId: child.areaId, schedule: child.schedule });
    }
    const names = byName(tags[owner] ?? []).map((t) => t.name);
    if (names.length) await repo.addTags(copy.id, names);
    return { ok: true, id: copy.id };
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
}

export type TagChoices = { on: TagName[]; known: TagName[]; colors: TagColors };

/**
 * The tags on an item (its series' for one time it happens, since tags belong
 * to the whole series), and every tag by use with its colour, for a row's tag chooser.
 */
export async function tagChoices(repo: ItemsRepo, rawKey: unknown, timeZone: string): Promise<TagChoices | null> {
  const key = parseItemKey(rawKey);
  if (!key) return null;
  const [found, tags] = await Promise.all([resolveKey(repo, key, timeZone), repo.listTags()]);
  if (!found) return null;
  const owner =
    found.kind === "virtual" ? found.series.id : found.item.recurrence.kind === "override" ? found.item.recurrence.seriesId : found.item.id;
  const on = byName((await repo.tagsForItems([owner]))[owner] ?? []).map((t) => t.name);
  return { on, known: byUse(tags), colors: tagColors(tags) };
}
