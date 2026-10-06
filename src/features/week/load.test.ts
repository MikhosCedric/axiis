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
    expect(calls.listForDay.map((r) => r.date)).toEqual(["2026-10-05"]);
    expect(week.days[0]).toBe("2026-10-05");
    expect(week.today).toBe("2026-10-08");
    expect(week.areas).toEqual([work]);
    expect(week.scheduled.map((i) => i.title)).toEqual(["Monday"]);
    expect(week.unscheduled.map((i) => i.title)).toEqual(["Someday"]);
  });
});
