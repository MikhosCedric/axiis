import { describe, expect, it } from "vitest";
import type { LocalDate, SpanRange } from "@/domain/item";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { loadWeek } from "./load";

const d = (s: string) => s as LocalDate;

describe("loadWeek", () => {
  it("reads the whole week in the user's zone, plus the waiting items", async () => {
    const monday = makeItem({ title: "Monday", schedule: { kind: "day", on: d("2026-10-05") } });
    // 20:00 UTC on Sunday the 11th is already Monday the 12th in Kolkata, so it belongs to next week.
    const lateSunday = makeItem({
      title: "Late Sunday",
      schedule: { kind: "timed", start: new Date("2026-10-11T20:00:00Z"), end: new Date("2026-10-11T21:00:00Z") },
    });
    const waiting = makeItem({ title: "Someday" });
    const work = area("Work");
    const { repo, calls } = fakeRepo([monday, lateSunday, waiting], [work]);
    const ranges: SpanRange[] = [];
    const listRange = repo.listRange;
    repo.listRange = (r) => (ranges.push(r), listRange(r));

    const week = await loadWeek(repo, d("2026-10-08"), new Date("2026-10-07T20:00:00Z"), "Asia/Kolkata");

    expect(ranges).toEqual([
      {
        from: new Date("2026-10-04T18:30:00Z"),
        to: new Date("2026-10-11T18:30:00Z"),
        fromDate: "2026-10-05",
        toDate: "2026-10-12",
      },
    ]);
    // The tray is today's: what was ticked done today stays in it.
    expect(calls.listForDay.map((r) => r.date)).toEqual(["2026-10-08"]);
    expect(week.days[0]).toBe("2026-10-05");
    expect(week.today).toBe("2026-10-08");
    expect(week.areas).toEqual([work]);
    expect(week.scheduled.map((i) => i.title)).toEqual(["Monday"]);
    expect(week.unscheduled.map((i) => i.title)).toEqual(["Someday"]);
  });

  it("adds each occurrence in the week and leaves the stored series out", async () => {
    const series = makeItem({
      title: "Gym",
      schedule: { kind: "day", on: d("2026-09-28") },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: ["MO", "TH"], end: { kind: "never" } } },
    });
    const skipped = makeItem({
      status: "dropped",
      schedule: { kind: "day", on: d("2026-10-08") },
      recurrence: { kind: "override", seriesId: series.id, originalOn: d("2026-10-08") },
    });
    const { repo } = fakeRepo([series, skipped]);
    const week = await loadWeek(repo, d("2026-10-08"), new Date("2026-10-07T20:00:00Z"), "UTC");
    expect(week.scheduled.map((i) => i.id)).toEqual([skipped.id, `${series.id}~2026-10-05`]);
  });
});
