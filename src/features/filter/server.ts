import { cache } from "react";
import { getItemsRepo } from "@/lib/items";
import { readFilter, type ViewFilter } from "./model";

/** The user's areas, read once per request: the rail reads them too, so a page's filter costs no read of its own. */
export const getAreas = cache(async () => (await getItemsRepo()).listAreas());

/** The filter a page's query names, checked against the user's areas. */
export async function getFilter(query: Promise<Record<string, string | string[] | undefined>>, tags: boolean): Promise<ViewFilter> {
  const [q, areas] = await Promise.all([query, getAreas()]);
  return readFilter(q, areas, { tags });
}
