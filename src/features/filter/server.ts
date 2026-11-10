import { cache } from "react";
import { getItemsRepo } from "@/lib/items";
import { checkTag, readFilter, type ViewFilter } from "./model";

/** The user's areas, read once per request: the rail reads them too, so a page's filter costs no read of its own. */
export const getAreas = cache(async () => (await getItemsRepo()).listAreas());

/** The user's tag names, read once per request and only when a page is filtered by a tag. */
const getTagNames = cache(async () => (await getItemsRepo()).listTagNames());

/** The filter a page's query names, checked against the user's areas and, for a tag, their tags. */
export async function getFilter(query: Promise<Record<string, string | string[] | undefined>>, tags: boolean): Promise<ViewFilter> {
  const [q, areas] = await Promise.all([query, getAreas()]);
  const filter = readFilter(q, areas, { tags });
  return filter.tag ? checkTag(filter, await getTagNames()) : filter;
}
