import type { Area } from "@/domain/item";
import { parseTagName, sameTag, type TagName } from "@/domain/tag";
import { AREA_PARAM, TAG_PARAM } from "./href";

/**
 * What a view is narrowed to: one area, one tag, both, or neither. Read from the
 * address on the server and checked there, so an area that is not the user's, or
 * a tag name that cannot be one, is simply not a filter.
 */
export type ViewFilter = {
  area: Area | null;
  tag: TagName | null;
  /** The tag in the address is no tag of the user's any more: it was deleted, renamed or merged away. */
  tagGone?: true;
  /**
   * Areas unticked in the side panel on this device: their items are left out of every view.
   * A view narrowed to one area by its address shows that area even when it is unticked here.
   */
  hidden?: readonly string[];
};

export const NO_FILTER: ViewFilter = { area: null, tag: null };

type Query = Record<string, string | string[] | undefined>;

/** The filter a page's query names. An unknown area is ignored; `tags: false` ignores the tag on views that never load tags. */
export function readFilter(query: Query, areas: readonly Area[], { tags, hidden = [] }: { tags: boolean; hidden?: readonly string[] }): ViewFilter {
  const areaId = query[AREA_PARAM];
  const tag = tags ? parseTagName(query[TAG_PARAM]) : null;
  const filter: ViewFilter = { area: areas.find((a) => a.id === areaId) ?? null, tag };
  // Only areas the user still has: an id left in the cookie by a deleted area hides nothing.
  const known = hidden.filter((id) => areas.some((a) => a.id === id));
  return known.length > 0 ? { ...filter, hidden: known } : filter;
}

/** Marks a tag filter whose tag the user no longer has, so the page can say so instead of showing an empty view. */
export function checkTag(f: ViewFilter, known: readonly { name: string }[]): ViewFilter {
  if (!f.tag || known.some((t) => sameTag(t.name, f.tag!))) return f;
  return { ...f, tagGone: true };
}

/** Narrowed by the address: one area, one tag or both. This is what the chip and the "in Work" words speak of. */
export const isFiltered = (f: ViewFilter) => f.area !== null || f.tag !== null;

/** Whether anything at all is left out: an address filter, or areas hidden in the side panel. */
export const narrows = (f: ViewFilter) => isFiltered(f) || (f.hidden?.length ?? 0) > 0;

/** The hidden areas that apply: none while the address names one area, which is then shown whatever is ticked. */
export const hiddenIn = (f: ViewFilter): readonly string[] => (f.area ? [] : (f.hidden ?? []));

/** Whether an item belongs in the filtered view. `tags` are the names it wears. */
export function keeps(f: ViewFilter, item: { areaId: string | null }, tags: readonly string[] | undefined): boolean {
  if (f.area && item.areaId !== f.area.id) return false;
  if (item.areaId !== null && hiddenIn(f).includes(item.areaId)) return false;
  if (f.tag && !(tags ?? []).some((t) => sameTag(t, f.tag!))) return false;
  return true;
}

/** The filter in words, for "3 of 5 done in Work" and the chip: "Work", "#errands", "Work and #errands". */
export function filterWords(f: ViewFilter): string {
  return [f.area?.name, f.tag && `#${f.tag}`].filter(Boolean).join(" and ");
}

/** " in Work" after a count, or nothing when the view is whole. */
export const scopeWords = (f: ViewFilter) => (isFiltered(f) ? ` in ${filterWords(f)}` : "");

/** "In Work: " before a page's summary sentence, or nothing when the view is whole. */
export const scopePrefix = (f: ViewFilter) => (isFiltered(f) ? `In ${filterWords(f)}: ` : "");
