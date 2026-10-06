import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { loadOccurrences } from "./occurrences";

const d = (s: string) => s as LocalDate;
const daily: Rule = { freq: "daily", interval: 1, end: { kind: "never" } };
const span = { from: new Date("2026-10-05T00:00:00Z"), to: new Date("2026-10-08T00:00:00Z"), fromDate: d("2026-10-05"), toDate: d("2026-10-08") };

describe("loadOccurrences", () => {
  it("draws each occurrence with the series' fields, open, under an occurrence key", async () => {
    const series = makeItem({
      title: "Stretch",
      type: "event",
      status: "done",
      dueOn: d("2026-12-01"),
      schedule: { kind: "timed", start: new Date("2026-10-01T07:00:00Z"), end: new Date("2026-10-01T07:20:00Z") },
      recurrence: { kind: "series", rule: daily },
    });
    const { repo } = fakeRepo([series]);
    const occ = await loadOccurrences(repo, span, "UTC");
    expect(occ.map((o) => o.id)).toEqual([`${series.id}~2026-10-05`, `${series.id}~2026-10-06`, `${series.id}~2026-10-07`]);
    expect(occ[1]).toMatchObject({
      title: "Stretch",
      type: "event",
      status: "open",
      completedAt: null,
      dueOn: null,
      recurrence: { kind: "occurrence", seriesId: series.id, originalOn: "2026-10-06" },
      schedule: { kind: "timed", start: new Date("2026-10-06T07:00:00Z"), end: new Date("2026-10-06T07:20:00Z") },
    });
  });

  it("leaves out dates that an override stands for: edited, moved away, or skipped", async () => {
    const series = makeItem({ schedule: { kind: "day", on: d("2026-10-01") }, recurrence: { kind: "series", rule: daily } });
    const override = (on: string, over: Parameters<typeof makeItem>[0]) =>
      makeItem({ recurrence: { kind: "override", seriesId: series.id, originalOn: d(on) }, ...over });
    const { repo } = fakeRepo([
      series,
      override("2026-10-05", { title: "Renamed", schedule: { kind: "day", on: d("2026-10-05") } }),
      override("2026-10-06", { schedule: { kind: "day", on: d("2026-10-20") } }),
      override("2026-10-07", { status: "dropped", schedule: { kind: "day", on: d("2026-10-07") } }),
    ]);
    expect(await loadOccurrences(repo, span, "UTC")).toEqual([]);
  });

  it("ignores items that do not repeat", async () => {
    const { repo } = fakeRepo([makeItem({ schedule: { kind: "day", on: d("2026-10-06") } })]);
    expect(await loadOccurrences(repo, span, "UTC")).toEqual([]);
  });
});
