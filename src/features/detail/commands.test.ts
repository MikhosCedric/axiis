import { describe, expect, it } from "vitest";
import type { ItemId } from "@/domain/item";
import type { ItemsRepo } from "@/lib/items/repo";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { addSubtask, deleteItem, loadDetail, promoteSubtask, renameItem, setItemArea } from "./commands";

const BAD_IDS = ["", "1; drop table items", null, 42, { id: "x" }];
const BAD_TITLES = ["", "   ", "x".repeat(501), null, 7];

/** Records soft deletes and fails loudly if anything writes in another way. */
function recordingRepo(...args: Parameters<typeof fakeRepo>) {
  const fake = fakeRepo(...args);
  const deleted: ItemId[] = [];
  fake.repo.softDelete = async (id) => {
    deleted.push(id);
  };
  return { ...fake, deleted };
}

function writes(calls: ReturnType<typeof fakeRepo>["calls"], deleted: ItemId[]) {
  return calls.create.length + calls.update.length + deleted.length;
}

describe("addSubtask", () => {
  it("creates an unscheduled task under the parent, in the parent's area", async () => {
    const home = area("Home");
    const parent = makeItem({
      type: "checklist",
      areaId: home.id,
      schedule: { kind: "timed", start: new Date("2026-10-06T09:00:00Z"), end: new Date("2026-10-06T10:00:00Z") },
    });
    const { repo, calls } = fakeRepo([parent], [home]);

    expect(await addSubtask(repo, parent.id, "  Pack charger ")).toEqual({ ok: true });
    expect(calls.create).toEqual([
      { type: "task", title: "Pack charger", parentId: parent.id, areaId: home.id, schedule: { kind: "unscheduled" } },
    ]);
  });

  it("offers a sentence, not a failed save, when the parent cannot hold subtasks", async () => {
    const top = makeItem();
    const child = makeItem({ parentId: top.id });
    const note = makeItem({ type: "note" });
    const event = makeItem({ type: "event" });
    const { repo, calls } = fakeRepo([top, child, note, event]);

    for (const parent of [child, note, event]) {
      const result = await addSubtask(repo, parent.id, "Deeper");
      expect(result).toEqual({ ok: false, error: "Subtasks go one level deep, under a task or a checklist." });
    }
    expect(calls.create).toEqual([]);
  });

  it("says plainly when the parent is gone", async () => {
    const { repo, calls } = fakeRepo();
    const result = await addSubtask(repo, makeItem().id, "Orphan");
    expect(result).toEqual({ ok: false, error: "That item is not here any more." });
    expect(calls.create).toEqual([]);
  });

  it("reports a failed save instead of throwing", async () => {
    const parent = makeItem();
    const { repo } = fakeRepo([parent]);
    repo.create = async () => {
      throw new Error("network");
    };
    expect(await addSubtask(repo, parent.id, "Try")).toEqual({ ok: false, error: "That change did not save. Try again." });
  });
});

describe("promoteSubtask", () => {
  it("clears the parent and nothing else", async () => {
    const parent = makeItem();
    const child = makeItem({ parentId: parent.id });
    const { repo, calls, items } = fakeRepo([parent, child]);

    expect(await promoteSubtask(repo, child.id)).toEqual({ ok: true });
    expect(calls.update).toEqual([[child.id, { parentId: null }]]);
    expect(items.find((i) => i.id === child.id)?.parentId).toBeNull();
  });
});

describe("deleteItem", () => {
  it("soft-deletes the subtasks first, then the item, and writes nothing else", async () => {
    const parent = makeItem();
    const a = makeItem({ parentId: parent.id });
    const b = makeItem({ parentId: parent.id });
    const { repo, calls, deleted } = recordingRepo([parent, a, b]);

    expect(await deleteItem(repo, parent.id, "UTC")).toEqual({ ok: true });
    expect(deleted).toEqual([a.id, b.id, parent.id]);
    expect(calls.update).toEqual([]);
    expect(calls.create).toEqual([]);
  });

  it("deletes a lone subtask on its own", async () => {
    const parent = makeItem();
    const child = makeItem({ parentId: parent.id });
    const { repo, deleted } = recordingRepo([parent, child]);

    expect(await deleteItem(repo, child.id, "UTC")).toEqual({ ok: true });
    expect(deleted).toEqual([child.id]);
  });

  it("leaves the parent in place when a subtask fails to delete", async () => {
    const parent = makeItem();
    const child = makeItem({ parentId: parent.id });
    const { repo, deleted } = recordingRepo([parent, child]);
    repo.softDelete = async (id) => {
      if (id === child.id) throw new Error("network");
      deleted.push(id);
    };

    expect((await deleteItem(repo, parent.id, "UTC")).ok).toBe(false);
    expect(deleted).toEqual([]);
  });
});

describe("renameItem and setItemArea", () => {
  it("saves a trimmed title", async () => {
    const item = makeItem();
    const { repo, calls } = fakeRepo([item]);
    expect(await renameItem(repo, item.id, " Call the bank ", "UTC")).toEqual({ ok: true });
    expect(calls.update).toEqual([[item.id, { title: "Call the bank" }]]);
  });

  it("moves an item into an area and back out", async () => {
    const work = area("Work");
    const item = makeItem();
    const { repo, calls } = fakeRepo([item], [work]);
    expect(await setItemArea(repo, item.id, work.id, "UTC")).toEqual({ ok: true });
    expect(await setItemArea(repo, item.id, null, "UTC")).toEqual({ ok: true });
    expect(calls.update).toEqual([
      [item.id, { areaId: work.id }],
      [item.id, { areaId: null }],
    ]);
  });
});

describe("invalid input", () => {
  it("never reaches the repo", async () => {
    const item = makeItem();
    const { repo, calls, deleted } = recordingRepo([item]);
    const touched: string[] = [];
    const guarded = new Proxy(repo, {
      get(target, key: keyof ItemsRepo) {
        touched.push(String(key));
        return target[key];
      },
    });

    for (const bad of BAD_IDS) {
      expect((await renameItem(guarded, bad, "Fine", "UTC")).ok).toBe(false);
      expect((await setItemArea(guarded, bad, null, "UTC")).ok).toBe(false);
      expect((await setItemArea(guarded, item.id, bad === null ? "nope" : bad, "UTC")).ok).toBe(false);
      expect((await addSubtask(guarded, bad, "Fine")).ok).toBe(false);
      expect((await promoteSubtask(guarded, bad)).ok).toBe(false);
      expect((await deleteItem(guarded, bad, "UTC")).ok).toBe(false);
    }
    for (const bad of BAD_TITLES) {
      expect(await renameItem(guarded, item.id, bad, "UTC")).toEqual({ ok: false, error: "A title needs a few words, up to 500 characters." });
      expect((await addSubtask(guarded, item.id, bad)).ok).toBe(false);
    }

    expect(touched).toEqual([]);
    expect(writes(calls, deleted)).toBe(0);
  });
});

describe("loadDetail", () => {
  it("loads subtasks for a parent and the parent for a subtask, in the user's zone", async () => {
    const work = area("Work");
    const parent = makeItem({
      title: "Trip",
      areaId: work.id,
      schedule: { kind: "timed", start: new Date("2026-10-06T03:30:00Z"), end: new Date("2026-10-06T04:00:00Z") },
    });
    const child = makeItem({ title: "Pack", parentId: parent.id, status: "done" });
    const { repo } = fakeRepo([parent, child], [work]);

    const parentView = await loadDetail(repo, { kind: "item", id: parent.id }, "Asia/Kolkata");
    expect(parentView?.when).toBe("Tuesday 6 October, 09:00 to 09:30");
    expect(parentView?.nesting).toEqual({ kind: "holds-subtasks", subtasks: [{ id: child.id, title: "Pack", done: true }] });

    const childView = await loadDetail(repo, { kind: "item", id: child.id }, "UTC");
    expect(childView?.nesting).toEqual({ kind: "is-subtask", parent: { id: parent.id, title: "Trip" } });
  });

  it("returns null for an item that is not there", async () => {
    const { repo } = fakeRepo();
    expect(await loadDetail(repo, { kind: "item", id: makeItem().id }, "UTC")).toBeNull();
  });
});
