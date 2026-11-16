import { describe, expect, it } from "vitest";
import type { Item } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { reorderChecklists, reorderChildren } from "./commands";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 8, minute));

function family() {
  const parent = makeItem({ type: "checklist", title: "Packing" });
  const lines = ["Socks", "Charger", "Passport"].map((title, i) => makeItem({ title, parentId: parent.id, createdAt: at(i) }));
  return { parent, lines, ...fakeRepo([parent, ...lines]) };
}

const titles = (items: Item[]) => items.map((i) => i.title);

describe("reorderChildren", () => {
  it("stores the order asked for, and the lines are read back that way", async () => {
    const { parent, lines, repo } = family();
    const [socks, charger, passport] = lines;
    expect(await reorderChildren(repo, parent.id, [passport.id, socks.id, charger.id])).toEqual({ ok: true });
    expect(titles(await repo.listChildren(parent.id))).toEqual(["Passport", "Socks", "Charger"]);
  });

  it("moves one line of an ordered list with one write", async () => {
    const { parent, lines, repo, calls } = family();
    const [socks, charger, passport] = lines;
    await reorderChildren(repo, parent.id, [passport.id, socks.id, charger.id]);
    calls.update.length = 0;
    await reorderChildren(repo, parent.id, [passport.id, charger.id, socks.id]);
    expect(calls.update).toHaveLength(1);
    expect(titles(await repo.listChildren(parent.id))).toEqual(["Passport", "Charger", "Socks"]);
  });

  it("writes nothing when the order is the stored one, and undoes a move by asking for the old order", async () => {
    const { parent, lines, repo, calls } = family();
    const before = lines.map((l) => l.id);
    await reorderChildren(repo, parent.id, [...before].reverse());
    await reorderChildren(repo, parent.id, before);
    expect(titles(await repo.listChildren(parent.id))).toEqual(["Socks", "Charger", "Passport"]);
    calls.update.length = 0;
    await reorderChildren(repo, parent.id, before);
    expect(calls.update).toEqual([]);
  });

  it("keeps a line added after a move at the end", async () => {
    const { parent, lines, repo } = family();
    await reorderChildren(repo, parent.id, [...lines].reverse().map((l) => l.id));
    await repo.create({ type: "task", title: "Adapter", parentId: parent.id });
    expect(titles(await repo.listChildren(parent.id))).toEqual(["Passport", "Charger", "Socks", "Adapter"]);
  });

  it("leaves a line it was not told about after the ones it was", async () => {
    const { parent, lines, repo } = family();
    const [socks, charger] = lines;
    await reorderChildren(repo, parent.id, [charger.id, socks.id]);
    expect(titles(await repo.listChildren(parent.id))).toEqual(["Charger", "Socks", "Passport"]);
  });

  it("changes only positions", async () => {
    const { parent, lines, repo, calls } = family();
    await reorderChildren(repo, parent.id, [...lines].reverse().map((l) => l.id));
    expect(calls.update.every(([, patch]) => Object.keys(patch).join() === "position")).toBe(true);
  });

  it.each([
    ["a line of another parent", (f: ReturnType<typeof family>, other: Item) => [f.lines[0].id, other.id]],
    ["the same line twice", (f: ReturnType<typeof family>) => [f.lines[0].id, f.lines[0].id]],
    ["an id that is not a uuid", () => ["1 or 1=1"]],
    ["no ids", () => []],
    ["something that is not a list", () => "socks"],
  ])("refuses %s without touching the repo", async (_, ids) => {
    const f = family();
    const other = makeItem({ parentId: makeItem().id });
    const result = await reorderChildren(f.repo, f.parent.id, ids(f, other));
    expect(result.ok).toBe(false);
    expect(f.calls.update).toEqual([]);
  });

  it("refuses a parent that is not a uuid", async () => {
    const { repo, lines } = family();
    expect((await reorderChildren(repo, "packing", [lines[0].id])).ok).toBe(false);
  });

  it("reports a failed save plainly instead of throwing", async () => {
    const { parent, lines, repo } = family();
    repo.update = async () => {
      throw new Error("network");
    };
    expect(await reorderChildren(repo, parent.id, [...lines].reverse().map((l) => l.id))).toEqual({
      ok: false,
      error: expect.stringContaining("did not save"),
    });
  });
});

describe("reorderChecklists", () => {
  function lists() {
    const made = ["Move", "Packing", "Groceries"].map((title, i) => makeItem({ type: "checklist", title, createdAt: at(i) }));
    const done = makeItem({ type: "checklist", title: "Party", status: "done", createdAt: at(9) });
    return { made, done, ...fakeRepo([...made, done, makeItem({ title: "A task" })]) };
  }

  it("starts newest first, and stores the order asked for", async () => {
    const { made, done, repo } = lists();
    const [move, packing, groceries] = made;
    expect(titles(await repo.listChecklists())).toEqual(["Groceries", "Packing", "Move", "Party"]);
    expect(await reorderChecklists(repo, [move.id, groceries.id, packing.id, done.id])).toEqual({ ok: true });
    expect(titles(await repo.listChecklists())).toEqual(["Move", "Groceries", "Packing", "Party"]);
  });

  it("keeps a checklist made after a move first", async () => {
    const { made, done, repo } = lists();
    await reorderChecklists(repo, [...made.map((m) => m.id), done.id]);
    await repo.create({ type: "checklist", title: "New" });
    expect(titles(await repo.listChecklists())).toEqual(["New", "Move", "Packing", "Groceries", "Party"]);
  });

  it("keeps open ones before done ones whatever is asked", async () => {
    const { made, done, repo } = lists();
    await reorderChecklists(repo, [done.id, ...made.map((m) => m.id)]);
    expect(titles(await repo.listChecklists())).toEqual(["Move", "Packing", "Groceries", "Party"]);
  });

  it("refuses an item that is not a checklist on the page", async () => {
    const { made, repo, calls } = lists();
    const result = await reorderChecklists(repo, [made[0].id, makeItem().id]);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("has changed") });
    expect(calls.update).toEqual([]);
  });
});
