import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { occurrenceKey, parseItemKey } from "@/domain/item-key";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { materialize, resolveKey } from "./occurrences";

const d = (s: string) => s as LocalDate;
const home = area("Home");

function world() {
  const series = makeItem({
    title: "Stretch",
    type: "event",
    areaId: home.id,
    body: { type: "doc", content: [] },
    schedule: { kind: "timed", start: new Date("2026-10-05T07:00:00Z"), end: new Date("2026-10-05T07:20:00Z") },
    recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: ["MO", "WE"], end: { kind: "never" } } },
  });
  return { series, ...fakeRepo([series], [home]) };
}
const key = (seriesId: string, on: string) => parseItemKey(occurrenceKey(seriesId as never, d(on)))!;

describe("resolveKey", () => {
  it("names a virtual occurrence on a date the series falls on, without writing", async () => {
    const { series, repo, calls } = world();
    const found = await resolveKey(repo, key(series.id, "2026-10-07"), "UTC");
    expect(found).toMatchObject({ kind: "virtual", series: { id: series.id }, item: { id: `${series.id}~2026-10-07` } });
    expect(calls.create).toEqual([]);
  });

  it("is null for a date the series does not fall on, or a series that is not there", async () => {
    const { series, repo } = world();
    expect(await resolveKey(repo, key(series.id, "2026-10-06"), "UTC")).toBeNull();
    expect(await resolveKey(repo, key(makeItem().id, "2026-10-07"), "UTC")).toBeNull();
  });

  it("is null when the id is an item that does not repeat", async () => {
    const plain = makeItem({ schedule: { kind: "day", on: d("2026-10-07") } });
    const { repo } = fakeRepo([plain]);
    expect(await resolveKey(repo, key(plain.id, "2026-10-07"), "UTC")).toBeNull();
  });
});

describe("materialize", () => {
  it("stores the occurrence as an override with the series' fields and that day's schedule", async () => {
    const { series, repo, calls } = world();
    const stored = await materialize(repo, key(series.id, "2026-10-07"), "UTC");
    expect(calls.create).toEqual([
      {
        type: "event",
        title: "Stretch",
        body: { type: "doc", content: [] },
        areaId: home.id,
        schedule: { kind: "timed", start: new Date("2026-10-07T07:00:00Z"), end: new Date("2026-10-07T07:20:00Z") },
        recurrence: { kind: "override", seriesId: series.id, originalOn: "2026-10-07" },
      },
    ]);
    expect(stored?.recurrence).toEqual({ kind: "override", seriesId: series.id, originalOn: "2026-10-07" });
  });

  it("is idempotent: a second call finds the first override", async () => {
    const { series, repo, items } = world();
    const first = await materialize(repo, key(series.id, "2026-10-07"), "UTC");
    const second = await materialize(repo, key(series.id, "2026-10-07"), "UTC");
    expect(second?.id).toBe(first?.id);
    expect(items.filter((i) => i.recurrence.kind === "override")).toHaveLength(1);
  });

  it("recovers when it loses a race to the unique index", async () => {
    const { series, repo } = world();
    const create = repo.create;
    let winner: string | undefined;
    // Another request stores the override between this one's read and its insert.
    repo.create = async (input) => {
      winner = (await create(input)).id;
      return create(input);
    };
    const stored = await materialize(repo, key(series.id, "2026-10-07"), "UTC");
    expect(stored?.id).toBe(winner);
  });

  it("returns a stored item unchanged", async () => {
    const { series, repo, calls } = world();
    expect((await materialize(repo, { kind: "item", id: series.id }, "UTC"))?.id).toBe(series.id);
    expect(calls.create).toEqual([]);
  });
});
