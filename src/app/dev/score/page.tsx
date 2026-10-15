import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DAY_VIEW_PARAM } from "@/features/day/types";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { instantAt, resolveTimeZone, toLocalDate } from "@/lib/dates";
import { loadDayData, SCORE_TAGS, seedFixture } from "./fixture";
import { ScoreHarness } from "./harness";

export const metadata: Metadata = { title: "Score harness" };

/**
 * Dev-only page that renders the day screen from fixture data, for checking the Score without a session.
 * `?tray=empty` leaves nothing waiting; `?firstday` starts from an account that has never stored an item;
 * `?at=13:00` sets the time of day, so a test that depends on where now falls does not depend on when it runs.
 */
export default async function ScoreHarnessPage({ searchParams }: PageProps<"/dev/score">) {
  if (!devHarnessEnabled()) notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const timeZone = resolveTimeZone(one(params.tz));
  const now = pinnedTime(one(params.at), timeZone) ?? new Date();
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

/** Today at a typed wall-clock time ("13:00") in `timeZone`, or null for anything else. */
function pinnedTime(at: string | undefined, timeZone: string): Date | null {
  const m = at ? /^(\d{2}):(\d{2})$/.exec(at) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return instantAt(toLocalDate(new Date(), timeZone), Number(m[1]) * 60 + Number(m[2]), timeZone);
}
