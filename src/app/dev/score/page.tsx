import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DAY_VIEW_PARAM } from "@/features/day/types";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { resolveTimeZone } from "@/lib/dates";
import { loadDayData, SCORE_TAGS, seedFixture } from "./fixture";
import { ScoreHarness } from "./harness";

export const metadata: Metadata = { title: "Score harness" };

/**
 * Dev-only page that renders the day screen from fixture data, for checking the Score without a session.
 * `?tray=empty` leaves nothing waiting; `?firstday` starts from an account that has never stored an item.
 */
export default async function ScoreHarnessPage({ searchParams }: PageProps<"/dev/score">) {
  if (!devHarnessEnabled()) notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const timeZone = resolveTimeZone(one(params.tz));
  const now = new Date();
  const seeded = seedFixture(now, timeZone);
  const { areas } = seeded;
  const items =
    params.firstday !== undefined
      ? []
      : params.tray === "empty"
        ? seeded.items.filter((i) => i.schedule.kind !== "unscheduled")
        : seeded.items;
  const initial = await loadDayData(tagByTitle(fakeRepo(structuredClone(items), areas), SCORE_TAGS).repo, now, timeZone);
  return (
    <ScoreHarness
      items={items}
      areas={areas}
      initial={initial}
      mode={one(params[DAY_VIEW_PARAM]) === "list" ? "list" : "score"}
    />
  );
}
