import type { ItemId, ItemType } from "@/domain/item";
import { byName, parseTagName, sameTag, type TagName, type TagSummary } from "@/domain/tag";
import { rank } from "@/features/palette/rank";

export const TAGS_PATH = "/tags";

export function tagHref(name: string): string {
  return `${TAGS_PATH}/${encodeURIComponent(name)}`;
}

/** One item on a tag's page, already worded for the user's zone. */
export type TaggedRow = {
  id: ItemId;
  type: ItemType;
  title: string;
  done: boolean;
  repeats: boolean;
  /** When it happens, null for a note. */
  when: string | null;
  area: string | null;
  /** Its other tags. */
  tags: TagName[];
};

/** Tag names with the most open items first, then by name, the order suggestions start from. */
export function byUse(tags: readonly TagSummary[]): TagName[] {
  return byName(tags)
    .sort((a, b) => b.open - a.open)
    .map((t) => t.name);
}

/** Most suggestions the tag field offers at once. */
export const SUGGESTIONS_MAX = 6;

/** Existing tags that match what is typed and are not on the item yet, best match first. Nothing typed offers the most used. */
export function suggestTags(all: readonly TagName[], current: readonly TagName[], input: string): TagName[] {
  const free = all.filter((t) => !current.some((c) => sameTag(c, t)));
  const query = input.trim().replace(/^#+/, "");
  return (query ? rank(free, query, (t) => [t]) : free).slice(0, SUGGESTIONS_MAX);
}

/**
 * Splits a search into its words and its `#tag` terms. A tag term is one word,
 * so a tag with a space in its name is found from its own page instead.
 */
export function splitTagTerms(query: string): { text: string; tags: TagName[] } {
  const tags: TagName[] = [];
  const words: string[] = [];
  for (const word of query.trim().split(/\s+/)) {
    const tag = word.startsWith("#") ? parseTagName(word) : null;
    if (tag) {
      if (!tags.some((t) => sameTag(t, tag))) tags.push(tag);
    } else if (word) words.push(word);
  }
  return { text: words.join(" "), tags };
}

/**
 * A row's tags as a quiet line ("#home #errands +2", the first `max` and a
 * count of the rest) and as words for a label ("tagged home and errands").
 * Both are empty for no tags.
 */
export function tagLine(tags: readonly string[], max = 3): { shown: string; spoken: string } {
  if (tags.length === 0) return { shown: "", spoken: "" };
  const rest = tags.length - max;
  const shown = tags.slice(0, max).map((t) => `#${t}`).join(" ") + (rest > 0 ? ` +${rest}` : "");
  const spoken = tags.length === 1 ? tags[0] : `${tags.slice(0, -1).join(", ")} and ${tags.at(-1)}`;
  return { shown, spoken: `tagged ${spoken}` };
}

/** The line under a tag page's heading. */
export function taggedSummary(rows: readonly { done: boolean }[]): string {
  if (rows.length === 0) return "Nothing carries this tag right now.";
  const done = rows.filter((r) => r.done).length;
  const open = rows.length - done;
  return done === 0 ? `${open} open.` : `${open === 0 ? "None" : open} open, ${done} done.`;
}

/**
 * The tag name a route segment names. Next hands dynamic segments over still
 * percent-encoded, so `/tags/Deep%20work` arrives as `Deep%20work`. A segment
 * that is not valid encoding is taken as it is.
 */
export function tagFromSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Says how many open items carry a tag. */
export function openCount(n: number): string {
  return n === 0 ? "None open" : `${n} open`;
}
