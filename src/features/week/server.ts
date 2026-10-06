import { cache } from "react";
import type { LocalDate } from "@/domain/item";
import { getNow, getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { loadWeek } from "./load";

/** One load per date per request. */
export const getWeek = cache(async (date: LocalDate) => loadWeek(await getItemsRepo(), date, getNow(), await getTimeZone()));
