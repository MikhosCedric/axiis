import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { loadDay } from "@/features/day/load";
import { filterWeek } from "@/features/filter/apply";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { loadWeek } from "@/features/week/load";
import { instantAt } from "@/lib/dates";
import { dayCalendar, weekCalendar } from "./load";

const d = (s: string) => s as LocalDate;
const now = new Date("2026-10-07T09:00:00Z");

describe("the grid's data", () => {
  it("takes a day's planned items for the grid and its Inbox for the tray, with the counts the day already read", async () => {
    const parent = makeItem({ title: "Pack", type: "checklist", schedule: { kind: "timed", start: instantAt(d("2026-10-07"), 600, "UTC"), end: instantAt(d("2026-10-07"), 660, "UTC") } });
    const child = makeItem({ title: "Socks", parentId: parent.id, status: "done", completedAt: now });
    const waiting = makeItem({ title: "Someday" });
    const { repo } = fakeRepo([parent, child, waiting]);
    const data = dayCalendar(await loadDay(repo, d("2026-10-07"), now, "UTC"));
    expect(data.today).toBe("2026-10-07");
    expect(data.items.map((i) => i.title)).toEqual(["Pack"]);
    expect(data.tray?.map((i) => i.title)).toEqual(["Someday"]);
    expect(data.childCounts[parent.id]).toEqual({ done: 1, total: 1 });
  });

  it("counts subtasks for a week once, and only for what a filter left in", async () => {
    const work = area("Work");
    const home = area("Home");
    const kept = makeItem({ title: "Plan", areaId: work.id, schedule: { kind: "day", on: d("2026-10-06") } });
    const hidden = makeItem({ title: "Shop", areaId: home.id, schedule: { kind: "day", on: d("2026-10-08") } });
    const step = makeItem({ title: "Outline", parentId: kept.id });
    const other = makeItem({ title: "Milk", parentId: hidden.id });
    const { repo } = fakeRepo([kept, hidden, step, other], [work, home]);
    const asked: string[][] = [];
    const childCounts = repo.childCounts;
    repo.childCounts = (ids) => (asked.push([...ids]), childCounts(ids));
    const week = filterWeek(await loadWeek(repo, d("2026-10-07"), now, "UTC"), { area: null, tag: null, hidden: [home.id] });
    const data = await weekCalendar(repo, week);
    expect(asked).toEqual([[kept.id]]);
    expect(data.items.map((i) => i.title)).toEqual(["Plan"]);
    expect(data.childCounts[kept.id]).toEqual({ done: 0, total: 1 });
    expect(data.tray).toEqual([]);
  });
});
