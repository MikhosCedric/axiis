import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { loadLists } from "./commands";

const at = (iso: string) => new Date(iso);

function world() {
  const home = area("Home");
  const packing = makeItem({ type: "checklist", title: "Pack for the coast", areaId: home.id, createdAt: at("2026-10-03T09:00:00Z") });
  const launch = makeItem({
    type: "checklist",
    title: "Launch day",
    schedule: { kind: "day", on: "2026-10-09" as LocalDate },
    createdAt: at("2026-10-01T09:00:00Z"),
  });
  const moved = makeItem({ type: "checklist", title: "Move flat", status: "done", createdAt: at("2026-10-05T09:00:00Z") });
  const weekly = makeItem({
    type: "checklist",
    title: "Weekly reset",
    schedule: { kind: "day", on: "2026-10-05" as LocalDate },
    recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } },
    createdAt: at("2026-09-20T09:00:00Z"),
  });
  const items = [
    packing,
    launch,
    moved,
    weekly,
    makeItem({ parentId: packing.id, title: "Sunscreen" }),
    makeItem({ parentId: packing.id, title: "Charger", status: "done" }),
    makeItem({ parentId: moved.id, title: "Boxes", status: "done" }),
    makeItem({
      type: "checklist",
      title: "Weekly reset, moved",
      schedule: { kind: "day", on: "2026-10-13" as LocalDate },
      recurrence: { kind: "override", seriesId: weekly.id, originalOn: "2026-10-12" as LocalDate },
    }),
    makeItem({ type: "checklist", title: "Never mind", status: "dropped" }),
    makeItem({ type: "checklist", title: "A list inside a task", parentId: launch.id }),
    makeItem({ title: "Book the dentist" }),
  ];
  return { fake: fakeRepo(items, [home]), packing, launch, moved, weekly };
}

describe("loadLists", () => {
  it("lists top-level checklists with or without a day, open first then newest, a series once", async () => {
    const { fake } = world();
    const { rows, full } = await loadLists(fake.repo, "UTC", "24");
    expect(rows.map((r) => r.title)).toEqual(["Pack for the coast", "Launch day", "Weekly reset", "Move flat"]);
    expect(full).toBe(false);
  });

  it("counts every checklist's lines in one read", async () => {
    const { fake, packing } = world();
    const reads: ItemId[][] = [];
    const count = fake.repo.childCounts;
    fake.repo.childCounts = (ids) => (reads.push(ids), count(ids));
    const { rows } = await loadLists(fake.repo, "UTC", "24");
    expect(reads).toHaveLength(1);
    expect(rows.find((r) => r.id === packing.id)?.progress).toEqual({ done: 1, total: 2 });
  });

  it("draws each row's plan, area, state and progress, and a series as repeating with no progress", async () => {
    const { fake } = world();
    const { rows } = await loadLists(fake.repo, "UTC", "24");
    expect(rows.map(({ title, done, repeats, when, area, progress }) => ({ title, done, repeats, when, area, progress }))).toEqual([
      { title: "Pack for the coast", done: false, repeats: false, when: null, area: "Home", progress: { done: 1, total: 2 } },
      { title: "Launch day", done: false, repeats: false, when: "Friday 9 October", area: null, progress: { done: 0, total: 1 } },
      { title: "Weekly reset", done: false, repeats: true, when: "Repeats every week on Monday", area: null, progress: null },
      { title: "Move flat", done: true, repeats: false, when: null, area: null, progress: { done: 1, total: 1 } },
    ]);
  });

  it("gives a checklist with no lines an empty count rather than none", async () => {
    const fake = fakeRepo([makeItem({ type: "checklist", title: "Garden" })]);
    const { rows } = await loadLists(fake.repo, "UTC", "24");
    expect(rows[0].progress).toEqual({ done: 0, total: 0 });
  });

  it("says when the read is full", async () => {
    const many = Array.from({ length: 200 }, (_, n) => makeItem({ type: "checklist", title: `List ${n}` }));
    expect((await loadLists(fakeRepo(many).repo, "UTC", "24")).full).toBe(true);
    expect((await loadLists(fakeRepo(many.slice(1)).repo, "UTC", "24")).full).toBe(false);
  });
});
