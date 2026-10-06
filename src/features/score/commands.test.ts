import { describe, expect, it } from "vitest";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { placeItem } from "./commands";

const start = new Date("2026-10-06T09:00:00Z");
const end = new Date("2026-10-06T09:30:00Z");

describe("placeItem", () => {
  it("saves a timed schedule and the new area", async () => {
    const item = makeItem();
    const work = area("Work");
    const { repo, calls } = fakeRepo([item]);
    expect(await placeItem(repo, item.id, { schedule: { kind: "timed", start, end }, areaId: work.id }, "UTC")).toEqual({ ok: true });
    expect(calls.update).toEqual([[item.id, { schedule: { kind: "timed", start, end }, areaId: work.id }]]);
  });

  it("leaves the area alone when the placement does not name one, and clears it when it is null", async () => {
    const item = makeItem();
    const { repo, calls } = fakeRepo([item]);
    await placeItem(repo, item.id, { schedule: { kind: "unscheduled" } }, "UTC");
    await placeItem(repo, item.id, { schedule: { kind: "day", on: "2026-10-06" }, areaId: null }, "UTC");
    expect(calls.update).toEqual([
      [item.id, { schedule: { kind: "unscheduled" } }],
      [item.id, { schedule: { kind: "day", on: "2026-10-06" }, areaId: null }],
    ]);
  });

  it.each([
    ["an end before the start", { schedule: { kind: "timed", start: end, end: start } }],
    ["a zero-length span", { schedule: { kind: "timed", start, end: start } }],
    ["a span over 25 hours", { schedule: { kind: "timed", start, end: new Date(start.getTime() + 26 * 3_600_000) } }],
    ["ISO strings instead of dates", { schedule: { kind: "timed", start: start.toISOString(), end: end.toISOString() } }],
    ["an invalid date", { schedule: { kind: "timed", start: new Date("nope"), end } }],
    ["a malformed day", { schedule: { kind: "day", on: "6 Oct" } }],
    ["an unknown kind", { schedule: { kind: "someday" } }],
    ["an area that is not a uuid", { schedule: { kind: "unscheduled" }, areaId: "work" }],
    ["no schedule", { areaId: null }],
    ["not an object", "tomorrow"],
  ])("rejects %s without touching the repo", async (_, placement) => {
    const item = makeItem();
    const { repo, calls } = fakeRepo([item]);
    const result = await placeItem(repo, item.id, placement, "UTC");
    expect(result.ok).toBe(false);
    expect(calls.update).toEqual([]);
  });

  it("refuses an id that is not a uuid", async () => {
    const { repo, calls } = fakeRepo();
    expect((await placeItem(repo, "1 or 1=1", { schedule: { kind: "unscheduled" } }, "UTC")).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });

  it("reports a failed save plainly instead of throwing", async () => {
    const item = makeItem();
    const { repo } = fakeRepo([item]);
    repo.update = async () => {
      throw new Error("network");
    };
    const result = await placeItem(repo, item.id, { schedule: { kind: "unscheduled" } }, "UTC");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("did not save") });
  });
});
