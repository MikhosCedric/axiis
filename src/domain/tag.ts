import type { AreaColor } from "./area-color";
import type { ItemId, ShownItem } from "./item";

export type TagId = string & { readonly __brand: "TagId" };

/**
 * A tag's name as stored and shown: as typed, but trimmed, with runs of spaces
 * collapsed and any leading `#` dropped. Two names are the same tag when they
 * match without case; the database holds that with a unique index on `lower(name)`.
 */
export type TagName = string & { readonly __brand: "TagName" };

/** `color` is a name from the area palette, or null for none, the default. */
export type Tag = { id: TagId; name: TagName; color: AreaColor | null };

/** The colour of each coloured tag, keyed by `tagKey` of its name. A tag with no colour is absent. */
export type TagColors = Record<string, AreaColor>;

export function tagColors(tags: readonly Pick<Tag, "name" | "color">[]): TagColors {
  const colors: TagColors = {};
  for (const t of tags) if (t.color) colors[tagKey(t.name)] = t.color;
  return colors;
}

/** A tag with how many open items carry it. Deleted items do not count; done and dropped ones are not open. */
export type TagSummary = Tag & { open: number };

export const TAG_NAME_MAX = 32;
/** Most tags one item can carry. */
export const TAGS_PER_ITEM = 10;
/** Most tags one user can have. */
export const TAGS_PER_USER = 200;

/** Parses an untrusted name into its stored form, or null when nothing usable is left. */
export function parseTagName(raw: unknown): TagName | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim().replace(/^#+/, "").trim();
  // Lengths count UTF-16 code units, as zod's min and max did.
  return name.length >= 1 && name.length <= TAG_NAME_MAX && !/\p{Cc}/u.test(name) ? (name as TagName) : null;
}

/** What two names are compared by. */
export const tagKey = (name: string) => name.toLowerCase();

export const sameTag = (a: string, b: string) => tagKey(a) === tagKey(b);

/** Tags in the order every list shows them: by name, ignoring case. */
export function byName<T extends { name: string }>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => tagKey(a.name).localeCompare(tagKey(b.name)));
}

/**
 * The stored item whose tags a shown item wears. Tags live on a series, so
 * every occurrence and override of a live series shows and edits the series'
 * tags. An override whose series is gone is an ordinary item with its own.
 */
export function tagOwner(item: Pick<ShownItem, "id" | "recurrence">, liveSeries: ReadonlySet<string>): ItemId {
  const r = item.recurrence;
  if (r.kind === "occurrence") return r.seriesId;
  if (r.kind === "override" && liveSeries.has(r.seriesId)) return r.seriesId;
  return item.id as ItemId;
}
