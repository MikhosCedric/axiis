import { SELECTED_ITEM_PARAM } from "@/features/day/types";

/*
 * The filter as it sits in an address. Kept apart from `model.ts`, which reads and
 * applies a filter on the server, so the rail and the palette, on every page, carry
 * only this.
 */

/** The query parameters a filter lives in. Every other parameter is the page's own. */
export const AREA_PARAM = "area";
export const TAG_PARAM = "tag";

/** The pages a filter narrows: every day, week and month, the Inbox, Due, Lists and the notes list. */
const FILTERABLE = /^\/(today|day\/[^/]+|week(\/[^/]+)?|month(\/[^/]+)?|inbox|due|lists|notes)\/?$/;

export const filterable = (pathname: string) => FILTERABLE.test(pathname);

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

/**
 * Where choosing an area from the rail, the palette or the A keys goes: the page
 * you are on, narrowed to it (null widens it back to every area), or Today when
 * this page cannot be narrowed. An open item is closed, since it may not be in
 * the area chosen; every other parameter, a tag filter included, is kept.
 */
export function areaHref(pathname: string, query: string, areaId: string | null): string {
  const here = filterable(pathname);
  const params = new URLSearchParams(here ? query : "");
  params.delete(SELECTED_ITEM_PARAM);
  const rest = params.toString();
  return withFilter(`${here ? pathname : "/today"}${rest ? `?${rest}` : ""}`, { area: areaId });
}
