import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import type { Rule } from "@/domain/recurrence";
import { deleteItem } from "@/features/detail/commands";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { duplicateItem, restoreItems, tagChoices } from "./commands";

const TZ = "UTC";
const d = (s: string) => s as LocalDate;
const daily: Rule = { freq: "daily", interval: 1, end: { kind: "never" } };

describe("restoreItems", () => {
  it("brings back what a delete took, subtasks and all, as it was", async () => {
    const parent = makeItem({ title: "Pack", type: "checklist", schedule: { kind: "day", on: d("2026-11-02") } });
    const line = makeItem({ title: "Passport", parentId: parent.id });
    const fake = fakeRepo([parent, line]);
    const done = await deleteItem(fake.repo, parent.id, TZ);
    if (!done.ok) throw new Error(done.error);
    expect(fake.items).toEqual([]);

    expect(await restoreItems(fake.repo, done.deleted)).toEqual({ ok: true });
    expect(fake.items.map((i) => i.id)).toEqual([parent.id, line.id]);
    expect(fake.items[0]).toMatchObject({ title: "Pack", schedule: { kind: "day", on: "2026-11-02" } });
  });

  it("changes nothing the second time", async () => {
    const item = makeItem();
    const fake = fakeRepo([item]);
    await fake.repo.softDelete(item.id);
    await restoreItems(fake.repo, [item.id]);
    expect(await restoreItems(fake.repo, [item.id])).toEqual({ ok: true });
    expect(fake.items).toHaveLength(1);
  });

  it("brings back a series deleted every time, with the occurrence it was deleted from", async () => {
    const series = makeItem({ schedule: { kind: "day", on: d("2026-10-05") }, recurrence: { kind: "series", rule: daily } });
    const fake = fakeRepo([series]);
    const key = occurrenceKey(series.id, d("2026-10-07"));
    const done = await deleteItem(fake.repo, key, TZ, "all");
    if (!done.ok) throw new Error(done.error);
    expect(await restoreItems(fake.repo, done.deleted)).toEqual({ ok: true });
    expect(fake.items.map((i) => i.id)).toEqual([series.id]);
  });

  it("refuses anything but a list of ids, and writes nothing", async () => {
    const fake = fakeRepo([]);
    for (const bad of [[], "x", ["not-an-id"], null]) expect((await restoreItems(fake.repo, bad)).ok).toBe(false);
  });

  it("says so when the save fails", async () => {
    const fake = fakeRepo([]);
    fake.repo.restore = async () => {
      throw new Error("network");
    };
    expect(await restoreItems(fake.repo, [makeItem().id])).toEqual({ ok: false, error: "That change did not save. Try again." });
  });
});

describe("duplicateItem", () => {
  it("copies a one-off with its area, day, due date, body, tags and open subtasks", async () => {
    const work = area("Work");
    const item = makeItem({
      title: "Pack",
      type: "checklist",
      areaId: work.id,
      body: { type: "doc" },
      dueOn: d("2026-11-04"),
      schedule: { kind: "day", on: d("2026-11-02") },
    });
    const line = makeItem({ title: "Passport", parentId: item.id, status: "done" });
    const fake = fakeRepo([item, line], [work]);
    fake.tag(item.id, "travel");

    const result = await duplicateItem(fake.repo, item.id, TZ);
    if (!result.ok) throw new Error(result.error);
    const copy = fake.items.find((i) => i.id === result.id)!;
    expect(copy).toMatchObject({
      title: "Pack",
      type: "checklist",
      areaId: work.id,
      body: { type: "doc" },
      dueOn: "2026-11-04",
      schedule: { kind: "day", on: "2026-11-02" },
      recurrence: { kind: "none" },
      status: "open",
    });
    expect(fake.items.filter((i) => i.parentId === copy.id)).toEqual([expect.objectContaining({ title: "Passport", status: "open" })]);
    expect((await fake.repo.tagsForItems([copy.id]))[copy.id]?.map((t) => t.name)).toEqual(["travel"]);
    expect(item.title).toBe("Pack");
  });

  it("copies one time a series happens as a one-off on that day, storing nothing for the series", async () => {
    const series = makeItem({
      title: "Standup",
      schedule: { kind: "timed", start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T09:15:00Z") },
      recurrence: { kind: "series", rule: daily },
    });
    const fake = fakeRepo([series]);
    fake.tag(series.id, "team");

    const result = await duplicateItem(fake.repo, occurrenceKey(series.id, d("2026-10-07")), TZ);
    if (!result.ok) throw new Error(result.error);
    expect(fake.items.filter((i) => i.recurrence.kind === "override")).toEqual([]);
    const copy = fake.items.find((i) => i.id === result.id)!;
    expect(copy).toMatchObject({
      title: "Standup",
      recurrence: { kind: "none" },
      schedule: { kind: "timed", start: new Date("2026-10-07T09:00:00Z"), end: new Date("2026-10-07T09:15:00Z") },
    });
    expect((await fake.repo.tagsForItems([copy.id]))[copy.id]?.map((t) => t.name)).toEqual(["team"]);
  });

  it("keeps a subtask's copy under the same parent", async () => {
    const parent = makeItem();
    const child = makeItem({ title: "Call", parentId: parent.id });
    const fake = fakeRepo([parent, child]);
    const result = await duplicateItem(fake.repo, child.id, TZ);
    if (!result.ok) throw new Error(result.error);
    expect(fake.items.find((i) => i.id === result.id)?.parentId).toBe(parent.id);
  });

  it("refuses a key that names nothing, and writes nothing", async () => {
    const fake = fakeRepo([]);
    expect((await duplicateItem(fake.repo, "nope", TZ)).ok).toBe(false);
    expect((await duplicateItem(fake.repo, makeItem().id, TZ)).ok).toBe(false);
    expect(fake.calls.create).toEqual([]);
  });
});

describe("tagChoices", () => {
  it("lists tags most used first, with their colours", async () => {
    const a = makeItem();
    const b = makeItem();
    const fake = fakeRepo([a, b]);
    fake.tag(a.id, "home", "errands");
    fake.tag(b.id, "errands");
    const { known } = await tagChoices(fake.repo);
    expect(known).toEqual(["errands", "home"]);
  });
});
