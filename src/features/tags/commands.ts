import { quickItem } from "@/features/actions/model";
import * as z from "zod/mini";
import { AREA_COLORS } from "@/domain/area-color";
import type { Clock } from "@/lib/clock";
import { idSchema, repeats, type Item, type ItemId, type ShownItem } from "@/domain/item";
import { parseItemKey, type ParsedItemKey } from "@/domain/item-key";
import {
  byName,
  parseTagName,
  sameTag,
  tagOwner,
  TAG_NAME_MAX,
  TAGS_PER_ITEM,
  TAGS_PER_USER,
  type Tag,
  type TagId,
  type TagName,
  type TagSummary,
  tagColors,
  type TagColors,
} from "@/domain/tag";
import { resolveKey } from "@/lib/items/occurrences";
import { TAGGED_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import { describeWhen, firstDay } from "@/features/detail/model";
import { cadence } from "@/features/detail/repeat";
import { displayTitle } from "@/features/notes/model";
import type { ActionResult } from "@/features/today/commands";
import type { TaggedRow } from "./model";
import { saveFailure } from "@/lib/quota";

function parseTagId(raw: unknown): TagId | null {
  const id = idSchema.safeParse(raw);
  return id.success ? (id.data as TagId) : null;
}

const NAME_ERROR = `A tag needs 1 to ${TAG_NAME_MAX} characters.`;
const MISSING_ITEM = "That item is not here any more.";
const MISSING_TAG = "That tag is not here any more.";
const NOT_SAVED = "That change did not save. Try again.";
const ITEM_FULL = `An item keeps up to ${TAGS_PER_ITEM} tags. Remove one to add another.`;
const USER_FULL = `Axiis keeps up to ${TAGS_PER_USER} tags. Delete one in Settings to make room.`;

async function attempt(work: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await work()) ?? { ok: true };
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
}

/**
 * The stored item whose tags the key's item wears: the series for any
 * occurrence or override of a live series, the item itself otherwise.
 */
async function ownerOf(repo: ItemsRepo, key: ParsedItemKey, timeZone: string): Promise<ItemId | null> {
  const found = await resolveKey(repo, key, timeZone);
  if (!found) return null;
  if (found.kind === "virtual") return found.series.id;
  const r = found.item.recurrence;
  const series = r.kind === "override" ? await repo.get(r.seriesId) : null;
  return tagOwner(found.item, new Set(series?.recurrence.kind === "series" ? [series.id] : []));
}

/**
 * Puts a tag on an item, making the tag when it is new. A tag the item already
 * has, in any case, counts as done. On an occurrence the tag goes on the series.
 */
export async function addTag(repo: ItemsRepo, rawKey: unknown, rawName: unknown, timeZone: string): Promise<ActionResult> {
  const name = parseTagName(rawName);
  if (!name) return { ok: false, error: NAME_ERROR };
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING_ITEM };
  return attempt(async () => {
    const owner = await ownerOf(repo, key, timeZone);
    if (!owner) return { ok: false, error: MISSING_ITEM };
    const [onItem, all] = await Promise.all([repo.tagsForItems([owner]), repo.listTagNames()]);
    const mine = onItem[owner] ?? [];
    if (mine.some((t) => sameTag(t.name, name))) return;
    if (mine.length >= TAGS_PER_ITEM) return { ok: false, error: ITEM_FULL };
    if (!all.some((t) => sameTag(t.name, name)) && all.length >= TAGS_PER_USER) return { ok: false, error: USER_FULL };
    await repo.addTags(owner, [name]);
  });
}

/**
 * Puts the tags read from a captured line on the new item, in one write
 * however many there are. Names past the item's or the user's limit, and all
 * of them if the write fails, come back as missed.
 */
export async function tagCaptured(
  repo: ItemsRepo,
  itemId: ItemId,
  names: readonly TagName[],
): Promise<{ tags: TagName[]; missed: TagName[] }> {
  if (names.length === 0) return { tags: [], missed: [] };
  const tags: TagName[] = [];
  const missed: TagName[] = [];
  try {
    const known = await repo.listTagNames();
    let room = TAGS_PER_USER - known.length;
    for (const name of names) {
      const fresh = !known.some((t) => sameTag(t.name, name));
      if (tags.length >= TAGS_PER_ITEM || (fresh && room <= 0)) missed.push(name);
      else {
        tags.push(name);
        if (fresh) room -= 1;
      }
    }
    if (tags.length) await repo.addTags(itemId, tags);
    return { tags, missed };
  } catch {
    return { tags: [], missed: [...tags, ...missed] };
  }
}

/** Takes a tag off an item, named the way it is shown. A tag that is not on it counts as taken off. */
export async function removeTag(repo: ItemsRepo, rawKey: unknown, rawName: unknown, timeZone: string): Promise<ActionResult> {
  const name = parseTagName(rawName);
  const key = parseItemKey(rawKey);
  if (!name || !key) return { ok: false, error: MISSING_ITEM };
  return attempt(async () => {
    const owner = await ownerOf(repo, key, timeZone);
    if (!owner) return { ok: false, error: MISSING_ITEM };
    const tag = ((await repo.tagsForItems([owner]))[owner] ?? []).find((t) => sameTag(t.name, name));
    if (tag) await repo.removeTag(owner, tag.id);
  });
}

/** Renames a tag everywhere it is used. Only its case may match another tag's name if that tag is itself. */
export async function renameTag(repo: ItemsRepo, rawId: unknown, rawName: unknown): Promise<ActionResult> {
  const id = parseTagId(rawId);
  if (!id) return { ok: false, error: MISSING_TAG };
  const name = parseTagName(rawName);
  if (!name) return { ok: false, error: NAME_ERROR };
  return attempt(async () => {
    const tags = await repo.listTagNames();
    const self = tags.find((t) => t.id === id);
    if (!self) return { ok: false, error: MISSING_TAG };
    if (self.name === name) return;
    const clash = tags.find((t) => t.id !== id && sameTag(t.name, name));
    if (clash) return { ok: false, error: `You already have a tag called ${clash.name}.` };
    await repo.renameTag(id, name);
  });
}

const colorSchema = z.nullable(z.enum(AREA_COLORS));

/** Sets a tag's colour to a palette name, or clears it with null. */
export async function setTagColor(repo: ItemsRepo, rawId: unknown, rawColor: unknown): Promise<ActionResult> {
  const id = parseTagId(rawId);
  if (!id) return { ok: false, error: MISSING_TAG };
  const color = colorSchema.safeParse(rawColor);
  if (!color.success) return { ok: false, error: "That colour is not one Axiis offers." };
  return attempt(async () => {
    const self = (await repo.listTagNames()).find((t) => t.id === id);
    if (!self) return { ok: false, error: MISSING_TAG };
    if (self.color !== color.data) await repo.setTagColor(id, color.data);
  });
}

/** Deletes a tag and takes it off every item. No item is deleted. */
export async function deleteTag(repo: ItemsRepo, rawId: unknown): Promise<ActionResult> {
  const id = parseTagId(rawId);
  if (!id) return { ok: false, error: MISSING_TAG };
  return attempt(() => repo.deleteTag(id));
}

/**
 * The tag names each shown item wears, keyed by the id it is shown with, and the
 * colour of each coloured one, read in one request however many items there are.
 * `liveSeries` are the ids of the series still there, so an override of one wears
 * the series' tags.
 */
export async function tagsOfShown(
  repo: ItemsRepo,
  shown: readonly ShownItem[],
  liveSeries: Iterable<ItemId>,
): Promise<{ names: Record<string, TagName[]>; colors: TagColors }> {
  if (shown.length === 0) return { names: {}, colors: {} };
  const live = new Set<string>(liveSeries);
  const owners = new Map(shown.map((i) => [i.id as string, tagOwner(i, live)]));
  const byOwner = await repo.tagsForItems([...new Set(owners.values())]);
  const names: Record<string, TagName[]> = {};
  for (const [id, owner] of owners) {
    const tags = byOwner[owner];
    if (tags?.length) names[id] = byName(tags).map((t) => t.name);
  }
  return { names, colors: tagColors(Object.values(byOwner).flat()) };
}

/** Every tag by name, with how many open items carry it. */
export async function loadTagIndex(repo: ItemsRepo): Promise<TagSummary[]> {
  return byName(await repo.listTags());
}

export type TaggedData = {
  tag: Tag;
  rows: TaggedRow[];
  /** The read hit its cap, so older items may not be shown. */
  full: boolean;
};

/** When an item happens, in words: its plan, or how a series repeats. Null for a note. */
export function whenOf(item: Item, timeZone: string, clock: Clock): string | null {
  if (item.type === "note") return null;
  const r = item.recurrence;
  if (r.kind === "series") {
    const every = cadence(r.rule, firstDay(item.schedule, timeZone));
    return `Repeats ${every}`;
  }
  return describeWhen(item.schedule, timeZone, clock);
}

/** The items with a tag, named any case, open first. Null when no tag has that name. */
export async function loadTagged(repo: ItemsRepo, rawName: unknown, timeZone: string, clock: Clock): Promise<TaggedData | null> {
  const name = parseTagName(rawName);
  if (!name) return null;
  const tag = (await repo.listTagNames()).find((t) => sameTag(t.name, name));
  if (!tag) return null;
  const [items, areas] = await Promise.all([repo.listTagged(tag.id), repo.listAreas()]);
  const tags = await repo.tagsForItems(items.map((i) => i.id));
  const areaOf = new Map(areas.map((a) => [a.id as string, a]));
  return {
    tag: { id: tag.id, name: tag.name, color: tag.color },
    rows: items.map((item) => ({
      quick: { ...quickItem(item, timeZone), title: displayTitle(item) },
      id: item.id,
      type: item.type,
      title: displayTitle(item),
      done: item.status === "done",
      repeats: repeats(item),
      when: whenOf(item, timeZone, clock),
      area: areaOf.get(item.areaId ?? "")?.name ?? null,
      areaColor: areaOf.get(item.areaId ?? "")?.color ?? null,
      tags: byName(tags[item.id] ?? [])
        .map((t) => t.name)
        .filter((n) => !sameTag(n, tag.name)),
    })),
    full: items.length >= TAGGED_LIMIT,
  };
}
