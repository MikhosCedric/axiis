import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { describeItem, restOfToday } from "./commands";

describe("describeItem", () => {
  it("names a stored item by the key it was asked for, with no link", async () => {
    const item = makeItem({ title: "dentist", status: "done" });
    const { repo } = fakeRepo([item]);
    const found = await describeItem(repo, item.id, "UTC");
    expect(found).toMatchObject({ key: item.id, title: "dentist", type: "task", done: true, href: null });
    expect(found?.quick).toMatchObject({ key: item.id, series: "none", day: null, subtask: false });
  });

  it("names an occurrence of a series by its occurrence key", async () => {
    const series = makeItem({
      title: "stretch",
      schedule: { kind: "day", on: "2026-10-05" as LocalDate },
      recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
    });
    const { repo } = fakeRepo([series]);
    const key = `${series.id}~2026-10-07`;
    const found = await describeItem(repo, key, "UTC");
    expect(found).toMatchObject({ key, title: "stretch", type: "task", done: false, href: null });
    expect(found?.quick).toMatchObject({ key, series: "occurrence", occurrence: key, day: "2026-10-07" });
  });

  it("is null for a key that is not one, an item that is gone, or a dropped item", async () => {
    const dropped = makeItem({ status: "dropped" });
    const { repo } = fakeRepo([dropped]);
    expect(await describeItem(repo, "not a key", "UTC")).toBeNull();
    expect(await describeItem(repo, "00000000-0000-4000-8000-999999999999", "UTC")).toBeNull();
    expect(await describeItem(repo, dropped.id, "UTC")).toBeNull();
  });
});

describe("restOfToday", () => {
  it("lists the open tasks planned for today, and nothing else", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    const open = makeItem({ title: "post the form", schedule: { kind: "day", on: "2026-10-06" as LocalDate } });
    const done = makeItem({ title: "call", status: "done", schedule: { kind: "day", on: "2026-10-06" as LocalDate } });
    const other = makeItem({ title: "later", schedule: { kind: "day", on: "2026-10-08" as LocalDate } });
    const { repo } = fakeRepo([open, done, other]);
    expect(await restOfToday(repo, now, "UTC")).toEqual([{ id: open.id, title: "post the form" }]);
  });
});
