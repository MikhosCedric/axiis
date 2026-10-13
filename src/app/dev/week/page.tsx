import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { loadWeek } from "@/features/week/load";
import { parseLocalDate, resolveTimeZone, toLocalDate } from "@/lib/dates";
import { seedWeek, WEEK_TAGS } from "./fixture";
import { WeekHarness } from "./harness";

export const metadata: Metadata = { title: "Week harness" };

/** Dev-only page that renders the week from fixture data. `?date=` picks the week, `?tz=` the zone. */
export default async function WeekHarnessPage({ searchParams }: PageProps<"/dev/week">) {
  if (!devHarnessEnabled()) notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const timeZone = resolveTimeZone(one(params.tz));
  const now = new Date();
  const date = parseLocalDate(one(params.date)) ?? toLocalDate(now, timeZone);
  const { items, areas } = seedWeek(date, now, timeZone);
  const initial = await loadWeek(tagByTitle(fakeRepo(structuredClone(items), areas), WEEK_TAGS).repo, date, now, timeZone);
  return <WeekHarness items={items} areas={areas} initial={initial} />;
}
