import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DAY_VIEW_PARAM } from "@/features/day/types";
import { fakeRepo } from "@/features/today/test-support";
import { resolveTimeZone } from "@/lib/dates";
import { loadDayData, seedFixture } from "./fixture";
import { ScoreHarness } from "./harness";

export const metadata: Metadata = { title: "Score harness" };

/** Dev-only page that renders the day screen from fixture data, for checking the Score without a session. */
export default async function ScoreHarnessPage({ searchParams }: PageProps<"/dev/score">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const timeZone = resolveTimeZone(one(params.tz));
  const now = new Date();
  const { items, areas } = seedFixture(now, timeZone);
  const initial = await loadDayData(fakeRepo(structuredClone(items), areas).repo, now, timeZone);
  return (
    <ScoreHarness
      items={items}
      areas={areas}
      initial={initial}
      mode={one(params[DAY_VIEW_PARAM]) === "list" ? "list" : "score"}
    />
  );
}
