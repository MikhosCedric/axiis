import { cookies } from "next/headers";
import { cache } from "react";
import { TZ_COOKIE } from "@/components/shell/cookies";
import type { LocalDate } from "@/domain/item";
import { getItemsRepo } from "@/lib/items";
import { resolveTimeZone, toLocalDate } from "@/lib/dates";
import { loadDay } from "./load";

const getTimeZone = cache(async () => resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value));

// One instant per request, so the shell and the page agree on which day is today.
const getNow = cache(() => new Date());

/** The user's current local date. */
export const getTodayDate = cache(async () => toLocalDate(getNow(), await getTimeZone()));

/** One load per date per request, shared by the shell's nav and the day page. */
export const getDay = cache(async (date: LocalDate) => loadDay(await getItemsRepo(), date, getNow(), await getTimeZone()));
