import { cookies } from "next/headers";
import { cache } from "react";
import { CLOCK_COOKIE, readClock, TZ_COOKIE } from "@/components/shell/cookies";
import type { LocalDate } from "@/domain/item";
import { getAreas } from "@/features/filter/server";
import { getItemsRepo } from "@/lib/items";
import { resolveTimeZone, toLocalDate } from "@/lib/dates";
import { loadDay } from "./load";
import { loadRailCounts } from "./rail";

export const getTimeZone = cache(async () => resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value));

/** The clock times are written in, as the root layout read it for the browser. */
export const getClock = cache(async () => readClock((await cookies()).get(CLOCK_COOKIE)?.value).clock);

// One instant per request, so the shell and the page agree on which day is today.
export const getNow = cache(() => new Date());

/** The user's current local date. */
export const getTodayDate = cache(async () => toLocalDate(getNow(), await getTimeZone()));

/** One load per date per request. */
export const getDay = cache(async (date: LocalDate) => loadDay(await getItemsRepo(), date, getNow(), await getTimeZone()));

/** The nav rail's areas with today's open count for each, once per request. */
export const getRailAreas = cache(async () => {
  const repo = await getItemsRepo();
  const [areas, open] = await Promise.all([getAreas(), loadRailCounts(repo, await getTodayDate(), await getTimeZone())]);
  return areas.map((a) => ({ id: a.id, name: a.name, color: a.color, open: open.get(a.id) ?? 0 }));
});
