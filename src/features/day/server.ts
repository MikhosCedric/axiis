import { cookies } from "next/headers";
import { cache } from "react";
import { readWeekStart, TZ_COOKIE, WEEK_START_COOKIE } from "@/components/shell/cookies";
import { getRequestClock } from "@/components/shell/request-clock";
import type { LocalDate } from "@/domain/item";
import { getAreas } from "@/features/filter/server";
import { getItemsRepo } from "@/lib/items";
import { resolveTimeZone, toLocalDate } from "@/lib/dates";
import { daySpan, loadOccurrences } from "@/lib/items/occurrences";
import { loadDay } from "./load";
import { loadRailCounts } from "./rail";
import { reminderRows } from "./reminders";
import { trayRows } from "./tray";

export const getTimeZone = cache(async () => resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value));

/** The clock times are written in, as the root layout read it for the browser. */
export const getClock = cache(async () => (await getRequestClock()).clock);

/** The first day of the week, as Settings chose it for this device, the way the root layout read it for the browser. */
export const getWeekStart = cache(async () => readWeekStart((await cookies()).get(WEEK_START_COOKIE)?.value));

/** The user's areas for a capture to match "@work" against, read only when the words hold an "@". */
export async function areasNamedIn(words: string | readonly string[]) {
  return [words].flat().some((w) => typeof w === "string" && w.includes("@")) ? getAreas() : [];
}

// One instant per request, so the shell and the page agree on which day is today.
export const getNow = cache(() => new Date());

/** The user's current local date. */
export const getTodayDate = cache(async () => toLocalDate(getNow(), await getTimeZone()));

/** The day's series occurrences: one read of the series and overrides per date per request, shared by the day and the nav rail. */
const getOccurrences = cache(async (date: LocalDate) => {
  const timeZone = await getTimeZone();
  return loadOccurrences(await getItemsRepo(), daySpan(date, timeZone), timeZone);
});

/** One load per date per request. */
export const getDay = cache(async (date: LocalDate) =>
  loadDay(await getItemsRepo(), date, getNow(), await getTimeZone(), getOccurrences(date)),
);

/** The nav rail's areas with today's open count for each, once per request. */
export const getRailAreas = cache(async () => {
  const repo = await getItemsRepo();
  const today = await getTodayDate();
  const [areas, open] = await Promise.all([getAreas(), loadRailCounts(repo, today, await getTimeZone(), getOccurrences(today))]);
  return areas.map((a) => ({ id: a.id, name: a.name, color: a.color, open: open.get(a.id) ?? 0 }));
});

/** The lines the desktop tray shows for today. Only asked for in the desktop shell, and the page loads the same day, so it is one read. */
export const getTrayRows = cache(async () => {
  const [today, timeZone, clock] = await Promise.all([getTodayDate(), getTimeZone(), getClock()]);
  return trayRows((await getDay(today)).view, today, getNow(), timeZone, clock);
});

/** What the desktop shell may notify about today. Asked for only in the shell, and from the day the page loads anyway. */
export const getReminders = cache(async () => reminderRows((await getDay(await getTodayDate())).view, getNow()));

/** What waits in the Inbox, and how many due dates have passed, for the badges on the places. Once per request. */
export const getRailBadges = cache(async () => {
  const repo = await getItemsRepo();
  const [inbox, overdue] = await Promise.all([repo.countInbox(), repo.countOverdueDue(await getTodayDate())]);
  return { inbox, overdue };
});
