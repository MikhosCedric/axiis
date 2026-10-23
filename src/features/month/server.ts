import { cache } from "react";
import { getClock, getNow, getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { loadMonth } from "./load";
import type { YearMonth } from "./model";
import type { ViewFilter } from "@/features/filter/model";

/** One load per month and filter per request. */
export const getMonth = cache(async (month: YearMonth, filter: ViewFilter) =>
  loadMonth(await getItemsRepo(), month, getNow(), await getTimeZone(), await getClock(), filter),
);
