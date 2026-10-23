import type { Area } from "@/domain/item";
import { parseTagName, sameTag, type TagName } from "@/domain/tag";

/** The query parameters a filter lives in. Every other parameter is the page's own. */
export const AREA_PARAM = "area";
export const TAG_PARAM = "tag";

/**
 * What a view is narrowed to: one area, one tag, both, or neither. Read from the
 * address on the server and checked there, so an area that is not the user's, or
 * a tag name that cannot be one, is simply not a filter.
 */
export type ViewFilter = { area: Area | null; tag: TagName | null };

export const NO_FILTER: ViewFilter = { area: null, tag: null };

type Query = Record<string, string | string[] | undefined>;

/** The filter a page's query names. An unknown area is ignored; `tags: false` ignores the tag on views that never load tags. */
export function readFilter(query: Query, areas: readonly Area[], { tags }: { tags: boolean }): ViewFilter {
  const areaId = query[AREA_PARAM];
  const tag = tags ? parseTagName(query[TAG_PARAM]) : null;
  return { area: areas.find((a) => a.id === areaId) ?? null, tag };
}

export const isFiltered = (f: ViewFilter) => f.area !== null || f.tag !== null;

/** Whether an item belongs in the filtered view. `tags` are the names it wears. */
export function keeps(f: ViewFilter, item: { areaId: string | null }, tags: readonly string[] | undefined): boolean {
  if (f.area && item.areaId !== f.area.id) return false;
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

/**
 * `href` with the given filter values set (null removes one) and every other
 * parameter of `href` kept. Works on paths with or without a query.
 */
export function withFilter(href: string, values: { area?: string | null; tag?: string | null }): string {
  const [path, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);
  for (const [key, value] of [
    [AREA_PARAM, values.area],
    [TAG_PARAM, values.tag],
  ] as const) {
    if (value === null) params.delete(key);
    else if (value !== undefined) params.set(key, value);
  }
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}
