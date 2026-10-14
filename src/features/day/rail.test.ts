import { describe, expect, it } from "vitest";
import type { AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { loadDay } from "./load";
import { loadRailCounts } from "./rail";

const d = (s: string) => s as LocalDate;
const daily: Rule = { freq: "daily", interval: 1, end: { kind: "never" } };

/** What the old nav counted: open entries with an area across the loaded day. */
async function countedFromDay(items: Item[], date: LocalDate, timeZone: string) {
  const { view } = await loadDay(fakeRepo(items).repo, date, new Date("2026-10-08T06:00:00Z"), timeZone);
  const counts = new Map<AreaId, number>();
  for (const { item, state } of [...view.scheduled, ...view.waiting]) {
    if (state !== "done" && item.areaId !== null) counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
  }
  return counts;
}

describe("loadRailCounts", () => {
  it("counts what the day screen shows open per area, series occurrences included", async () => {
    const work = area("Work").id;
    const home = area("Home").id;
    const at = (h: number) => new Date(Date.UTC(2026, 9, 8, h));
    const parent = makeItem({ title: "Parent", areaId: work });
    const series = makeItem({
      title: "Standup",
      areaId: work,
      schedule: { kind: "timed", start: new Date("2026-10-01T09:00:00Z"), end: new Date("2026-10-01T09:15:00Z") },
      recurrence: { kind: "series", rule: daily },
    });
    const skippedSeries = makeItem({
      title: "Run",
      areaId: home,
      schedule: { kind: "day", on: d("2026-10-01") },
      recurrence: { kind: "series", rule: daily },
    });
    const items = [
      makeItem({ title: "Timed", areaId: work, schedule: { kind: "timed", start: at(10), end: at(11) } }),
      makeItem({ title: "Done", areaId: work, status: "done", completedAt: at(9), schedule: { kind: "day", on: d("2026-10-08") } }),
      makeItem({ title: "Dropped", areaId: home, status: "dropped", schedule: { kind: "day", on: d("2026-10-08") } }),
      makeItem({ title: "Yesterday", areaId: home, schedule: { kind: "day", on: d("2026-10-07") } }),
      makeItem({ title: "Waiting", areaId: home }),
      makeItem({ title: "No area" }),
      makeItem({ title: "Note", type: "note", areaId: home }),
      parent,
      makeItem({ title: "Loose subtask", areaId: work, parentId: parent.id }),
      makeItem({ title: "Planned subtask", areaId: work, parentId: parent.id, schedule: { kind: "day", on: d("2026-10-08") } }),
      series,
      skippedSeries,
      makeItem({
        title: "Run",
        areaId: home,
        status: "dropped",
        schedule: { kind: "day", on: d("2026-10-08") },
        recurrence: { kind: "override", seriesId: skippedSeries.id as ItemId, originalOn: d("2026-10-08") },
      }),
    ];

    const rail = await loadRailCounts(fakeRepo(items).repo, d("2026-10-08"), "UTC");

    expect(rail).toEqual(await countedFromDay(items, d("2026-10-08"), "UTC"));
    // Timed, Parent, Planned subtask and today's Standup; Waiting.
    expect(rail).toEqual(
      new Map([
        [work, 4],
        [home, 1],
      ]),
    );
  });
});
