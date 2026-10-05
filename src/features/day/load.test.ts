import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { loadDay } from "./load";

const d = (s: string) => s as LocalDate;

describe("loadDay", () => {
  it("queries the requested local day and builds the view from it", async () => {
    const inRange = makeItem({
      title: "Standup",
      schedule: { kind: "timed", start: new Date("2026-10-08T03:30:00Z"), end: new Date("2026-10-08T04:00:00Z") },
    });
    const dayBefore = makeItem({
      title: "Late",
      schedule: { kind: "timed", start: new Date("2026-10-07T18:00:00Z"), end: new Date("2026-10-07T19:00:00Z") },
    });
    const work = area("Work");
    const { repo, calls } = fakeRepo([inRange, dayBefore, makeItem({ title: "Someday" })], [work]);
    const now = new Date("2026-10-06T01:00:00Z");

    const day = await loadDay(repo, d("2026-10-08"), now, "Asia/Kolkata");

    expect(calls.listForDay).toEqual([
      { date: "2026-10-08", from: new Date("2026-10-07T18:30:00Z"), to: new Date("2026-10-08T18:30:00Z") },
    ]);
    expect(day.date).toBe("2026-10-08");
    expect(day.timeZone).toBe("Asia/Kolkata");
    expect(day.nowIso).toBe("2026-10-06T01:00:00.000Z");
    expect(day.areas).toEqual([work]);
    expect(day.view.scheduled.map((e) => e.item.title)).toEqual(["Standup"]);
    expect(day.view.waiting.map((e) => e.item.title)).toEqual(["Someday"]);
  });

  it("knows whether the date is today in the user's zone", async () => {
    const { repo } = fakeRepo();
    // 20:00 UTC on the 6th is already the 7th in Kolkata.
    const now = new Date("2026-10-06T20:00:00Z");
    expect((await loadDay(repo, d("2026-10-07"), now, "Asia/Kolkata")).isToday).toBe(true);
    expect((await loadDay(repo, d("2026-10-06"), now, "Asia/Kolkata")).isToday).toBe(false);
    expect((await loadDay(repo, d("2026-10-06"), now, "UTC")).isToday).toBe(true);
  });

  it("counts subtasks only for the items it shows", async () => {
    const planned = makeItem({ title: "Pack", type: "checklist", schedule: { kind: "day", on: d("2026-10-08") } });
    const waiting = makeItem({ title: "Plan trip" });
    const elsewhere = makeItem({ title: "Other day", schedule: { kind: "day", on: d("2026-10-09") } });
    const children = [
      makeItem({ parentId: planned.id, status: "done", schedule: { kind: "unscheduled" } }),
      makeItem({ parentId: planned.id, schedule: { kind: "unscheduled" } }),
      makeItem({ parentId: waiting.id, schedule: { kind: "unscheduled" } }),
      makeItem({ parentId: elsewhere.id, schedule: { kind: "unscheduled" } }),
    ];
    const { repo } = fakeRepo([planned, waiting, elsewhere, ...children]);

    const day = await loadDay(repo, d("2026-10-08"), new Date("2026-10-06T08:00:00Z"), "UTC");

    expect(day.childCounts).toEqual({
      [planned.id]: { total: 2, done: 1 },
      [waiting.id]: { total: 1, done: 0 },
    });
  });
});
