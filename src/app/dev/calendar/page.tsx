import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CalendarMode } from "@/features/calendar/grid-layout";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { instantAt, parseLocalDate, resolveTimeZone, toLocalDate } from "@/lib/dates";
import { devHarnessEnabled } from "@/lib/dev-harness";
import { WEEK_TAGS } from "../week/fixture";
import { loadCalendar, seedCalendar } from "./fixture";
import { CalendarHarness } from "./harness";

export const metadata: Metadata = { title: "Calendar harness" };

const SPANS: readonly CalendarMode[] = ["day", "3day", "week"];

/**
 * Dev-only page that draws the calendar's time grid from fixture data, before it is wired into the real
 * routes. `?span=day|3day|week` picks the span it opens on, `?date=` the week, `?tz=` the zone, and
 * `?at=13:00` pins the time of day, so a test that depends on where now falls does not depend on when it runs.
 */
export default async function CalendarHarnessPage({ searchParams }: PageProps<"/dev/calendar">) {
  if (!devHarnessEnabled()) notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const timeZone = resolveTimeZone(one(params.tz));
  const pinned = pinnedTime(one(params.at), timeZone);
  const now = pinned ?? new Date();
  const date = parseLocalDate(one(params.date)) ?? toLocalDate(now, timeZone);
  const { items, areas } = seedCalendar(date, now, timeZone);
  const initial = await loadCalendar(tagByTitle(fakeRepo(structuredClone(items), areas), WEEK_TAGS).repo, date, now, timeZone);
  const span = SPANS.find((s) => s === one(params.span)) ?? "week";
  return <CalendarHarness items={items} areas={areas} initial={initial.data} week={initial.week} shown={date} span={span} pinned={pinned !== null} />;
}

/** Today at a typed wall-clock time ("13:00") in `timeZone`, or null for anything else. */
function pinnedTime(at: string | undefined, timeZone: string): Date | null {
  const m = at ? /^(\d{2}):(\d{2})$/.exec(at) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return instantAt(toLocalDate(new Date(), timeZone), Number(m[1]) * 60 + Number(m[2]), timeZone);
}
