import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { describeItem } from "./commands";

describe("describeItem", () => {
  it("names a stored item by the key it was asked for, with no link", async () => {
    const item = makeItem({ title: "dentist", status: "done" });
    const { repo } = fakeRepo([item]);
    expect(await describeItem(repo, item.id, "UTC")).toEqual({ key: item.id, title: "dentist", type: "task", done: true, href: null });
  });

  it("names an occurrence of a series by its occurrence key", async () => {
    const series = makeItem({
      title: "stretch",
      schedule: { kind: "day", on: "2026-10-05" as LocalDate },
      recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
    });
    const { repo } = fakeRepo([series]);
    const key = `${series.id}~2026-10-07`;
    expect(await describeItem(repo, key, "UTC")).toEqual({ key, title: "stretch", type: "task", done: false, href: null });
  });

  it("is null for a key that is not one, an item that is gone, or a dropped item", async () => {
    const dropped = makeItem({ status: "dropped" });
    const { repo } = fakeRepo([dropped]);
    expect(await describeItem(repo, "not a key", "UTC")).toBeNull();
    expect(await describeItem(repo, "00000000-0000-4000-8000-999999999999", "UTC")).toBeNull();
    expect(await describeItem(repo, dropped.id, "UTC")).toBeNull();
  });
});
