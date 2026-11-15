import { cookies } from "next/headers";
import { cache } from "react";
import { HIDDEN_AREAS_COOKIE, readHiddenAreas } from "@/components/shell/cookies";
import { getItemsRepo } from "@/lib/items";
import { checkTag, readFilter, type ViewFilter } from "./model";

/** The user's areas, read once per request: the rail reads them too, so a page's filter costs no read of its own. */
export const getAreas = cache(async () => (await getItemsRepo()).listAreas());

/** The user's tag names, read once per request and only when a page is filtered by a tag. */
const getTagNames = cache(async () => (await getItemsRepo()).listTagNames());

/** The areas unticked in the side panel on this device, read once per request. Every view's filter carries them. */
export const getHiddenAreas = cache(async () => readHiddenAreas((await cookies()).get(HIDDEN_AREAS_COOKIE)?.value));

/** The filter a page's query names, with the areas hidden in the side panel, checked against the user's areas and, for a tag, their tags. */
export async function getFilter(query: Promise<Record<string, string | string[] | undefined>>, tags: boolean): Promise<ViewFilter> {
  const [q, areas, hidden] = await Promise.all([query, getAreas(), getHiddenAreas()]);
  const filter = readFilter(q, areas, { tags, hidden });
  return filter.tag ? checkTag(filter, await getTagNames()) : filter;
}
