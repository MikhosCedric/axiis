import { cache } from "react";
import { getClock, getNow, getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { loadMonth } from "./load";
import type { YearMonth } from "./model";

/** One load per month per request. */
export const getMonth = cache(async (month: YearMonth) => loadMonth(await getItemsRepo(), month, getNow(), await getTimeZone(), await getClock()));
