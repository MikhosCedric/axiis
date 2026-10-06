import type { ItemId, ItemType } from "@/domain/item";
import { parseTagName, sameTag, type TagName } from "@/domain/tag";
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

/** Says how many open items carry a tag. */
export function openCount(n: number): string {
  return n === 0 ? "None open" : `${n} open`;
}
