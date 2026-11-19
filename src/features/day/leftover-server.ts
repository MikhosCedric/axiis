import { cache } from "react";
import type { LocalDate } from "@/domain/item";
import type { ViewFilter } from "@/features/filter/model";
import { getItemsRepo } from "@/lib/items";
import { getTimeZone } from "./server";
import { loadLeftover } from "./leftover";

/** What Week and Month say is left over from earlier days: one bounded read, once per request, and only on a page that draws it. */
export const getLeftover = cache(async (today: LocalDate, filter: ViewFilter) => loadLeftover(await getItemsRepo(), today, await getTimeZone(), filter));
