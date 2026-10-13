import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { WAITING_LIMIT } from "@/lib/items/repo";
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
    expect(day.waitingFull).toBe(false);
  });

  it("keeps every open waiting item however many were done before, and says when the tray hits its cap", async () => {
    const created = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 60_000);
    const doneLongAgo = Array.from({ length: 1500 }, (_, i) =>
      makeItem({ title: `Old ${i}`, status: "done", completedAt: new Date("2025-01-01T00:00:00Z"), createdAt: created(i) }),
    );
    const open = makeItem({ title: "Still open", createdAt: new Date("2020-01-01T00:00:00Z") });
    const { repo } = fakeRepo([...doneLongAgo, open]);

    const day = await loadDay(repo, d("2026-10-08"), new Date("2026-10-08T06:00:00Z"), "UTC");
    expect(day.view.waiting.map((e) => e.item.title)).toEqual(["Still open"]);
    expect(day.waitingFull).toBe(false);

    const many = Array.from({ length: WAITING_LIMIT + 1 }, (_, i) => makeItem({ title: `Open ${i}`, createdAt: created(i) }));
    const full = await loadDay(fakeRepo(many).repo, d("2026-10-08"), new Date("2026-10-08T06:00:00Z"), "UTC");
    expect(full.view.waiting).toHaveLength(WAITING_LIMIT);
    expect(full.view.waiting[0].item.title).toBe(`Open ${WAITING_LIMIT}`);
    expect(full.waitingFull).toBe(true);
  });

  it("names the tags on everything shown in one read, an occurrence wearing its series'", async () => {
    const series = makeItem({
      title: "Standup",
      schedule: { kind: "timed", start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T09:15:00Z") },
      recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
    });
    const loose = makeItem({ title: "Someday" });
    const plain = makeItem({ title: "Plain" });
    const fake = fakeRepo([series, loose, plain]);
    fake.tag(series.id, "team");
    fake.tag(loose.id, "home", "Errands");
    let reads = 0;
    const repo = { ...fake.repo, tagsForItems: (ids: Parameters<typeof fake.repo.tagsForItems>[0]) => (reads++, fake.repo.tagsForItems(ids)) };

    const day = await loadDay(repo, d("2026-10-08"), new Date("2026-10-08T08:00:00Z"), "UTC");

    expect(day.tags).toEqual({ [`${series.id}~2026-10-08`]: ["team"], [loose.id]: ["Errands", "home"] });
    expect(reads).toBe(1);
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

describe("loadDay with repeating items", () => {
  const daily: Rule = { freq: "daily", interval: 1, end: { kind: "never" } };
  const nineToTen = { kind: "timed", start: new Date("2026-10-06T09:00:00Z"), end: new Date("2026-10-06T10:00:00Z") } as const;

  it("shows the series as one occurrence on its first day, not as the stored series as well", async () => {
    const series = makeItem({ title: "Standup", schedule: nineToTen, recurrence: { kind: "series", rule: daily } });
    const { repo } = fakeRepo([series]);
    const day = await loadDay(repo, d("2026-10-06"), new Date("2026-10-06T08:00:00Z"), "UTC");
    expect(day.view.scheduled.map((e) => e.item.id)).toEqual([`${series.id}~2026-10-06`]);
  });

  it("shows an occurrence on a later day, and the override in place of its date", async () => {
    const series = makeItem({ title: "Standup", schedule: nineToTen, recurrence: { kind: "series", rule: daily } });
    const done = makeItem({
      title: "Standup",
      status: "done",
      schedule: { kind: "timed", start: new Date("2026-10-08T11:00:00Z"), end: new Date("2026-10-08T12:00:00Z") },
      recurrence: { kind: "override", seriesId: series.id, originalOn: d("2026-10-08") },
    });
    const { repo } = fakeRepo([series, done]);
    const on = async (date: string) =>
      (await loadDay(repo, d(date), new Date("2026-10-06T08:00:00Z"), "UTC")).view.scheduled.map((e) => [e.item.id, e.state]);
    expect(await on("2026-10-07")).toEqual([[`${series.id}~2026-10-07`, "planned"]]);
    expect(await on("2026-10-08")).toEqual([[done.id, "done"]]);
  });

  it("hides a skipped occurrence and shows a moved one on its new day only", async () => {
    const series = makeItem({ schedule: { kind: "day", on: d("2026-10-06") }, recurrence: { kind: "series", rule: daily } });
    const skipped = makeItem({
      status: "dropped",
      schedule: { kind: "day", on: d("2026-10-07") },
      recurrence: { kind: "override", seriesId: series.id, originalOn: d("2026-10-07") },
    });
    const moved = makeItem({
      title: "Moved",
      schedule: { kind: "day", on: d("2026-10-07") },
      recurrence: { kind: "override", seriesId: series.id, originalOn: d("2026-10-08") },
    });
    const { repo } = fakeRepo([series, skipped, moved]);
    const now = new Date("2026-10-06T08:00:00Z");
    expect((await loadDay(repo, d("2026-10-07"), now, "UTC")).view.scheduled.map((e) => e.item.id)).toEqual([moved.id]);
    expect((await loadDay(repo, d("2026-10-08"), now, "UTC")).view.scheduled).toEqual([]);
  });

  it("says how often each series repeats, for the offer to time all of them", async () => {
    const standup = makeItem({ schedule: nineToTen, recurrence: { kind: "series", rule: daily } });
    const weekly = makeItem({
      schedule: { kind: "day", on: d("2026-10-06") },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } },
    });
    const { repo } = fakeRepo([standup, weekly]);
    const day = await loadDay(repo, d("2026-10-07"), new Date("2026-10-06T08:00:00Z"), "UTC");
    expect(day.cadences).toEqual({ [standup.id]: "every day", [weekly.id]: "every week on Tuesday" });
  });

  it("asks for child counts of stored items only", async () => {
    const series = makeItem({ schedule: { kind: "day", on: d("2026-10-06") }, recurrence: { kind: "series", rule: daily } });
    const plain = makeItem({ schedule: { kind: "day", on: d("2026-10-06") } });
    const { repo } = fakeRepo([series, plain]);
    const asked: string[][] = [];
    repo.childCounts = async (ids) => (asked.push(ids), {});
    await loadDay(repo, d("2026-10-06"), new Date("2026-10-06T08:00:00Z"), "UTC");
    expect(asked).toEqual([[plain.id]]);
  });
});
