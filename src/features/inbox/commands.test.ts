import { describe, expect, it } from "vitest";
import type { Item, ItemId, LocalDate } from "@/domain/item";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { INBOX_LIMIT } from "@/lib/items/repo";
import { loadInbox, planItem } from "./commands";

const d = (s: string) => s as LocalDate;
const at = (iso: string) => new Date(iso);
// 23:30 on 6 October in UTC is already 7 October in Auckland.
const NOW = at("2026-10-06T23:30:00Z");

describe("loadInbox", () => {
  it("keeps open, unscheduled, top-level tasks, events and checklists, newest first", async () => {
    const older = makeItem({ title: "Older task", createdAt: at("2026-10-01T09:00:00Z") });
    const event = makeItem({ type: "event", title: "Call back", createdAt: at("2026-10-03T09:00:00Z") });
    const list = makeItem({ type: "checklist", title: "Packing", createdAt: at("2026-10-05T09:00:00Z") });
    const series = makeItem({ id: "00000000-0000-4000-8000-0000000000aa" as ItemId });
    const left: Item[] = [
      makeItem({ type: "note", title: "A note" }),
      makeItem({ title: "Done", status: "done" }),
      makeItem({ title: "Dropped", status: "dropped" }),
      makeItem({ title: "On a day", schedule: { kind: "day", on: d("2026-10-06") } }),
      makeItem({ title: "Timed", schedule: { kind: "timed", start: at("2026-10-06T09:00:00Z"), end: at("2026-10-06T10:00:00Z") } }),
      makeItem({ title: "Subtask", parentId: list.id }),
      makeItem({ title: "Override", recurrence: { kind: "override", seriesId: series.id, originalOn: d("2026-10-06") } }),
    ];
    const { repo } = fakeRepo([older, ...left, event, list]);

    const data = await loadInbox(repo, NOW, "UTC");

    expect(data.items.map((i) => i.title)).toEqual(["Packing", "Call back", "Older task"]);
    expect(data.full).toBe(false);
  });

  it("dates today in the user's time zone and counts subtasks of what it shows", async () => {
    const list = makeItem({ type: "checklist", title: "Packing" });
    const home = area("Home");
    const { repo } = fakeRepo(
      [list, makeItem({ parentId: list.id, status: "done" }), makeItem({ parentId: list.id })],
      [home],
    );

    const data = await loadInbox(repo, NOW, "Pacific/Auckland");

    expect(data.today).toBe("2026-10-07");
    expect(data.timeZone).toBe("Pacific/Auckland");
    expect(data.areas).toEqual([home]);
    expect(data.childCounts).toEqual({ [list.id]: { total: 2, done: 1 } });
  });

  it("says when the cap is reached", async () => {
    const many = Array.from({ length: INBOX_LIMIT + 5 }, (_, n) => makeItem({ title: `Item ${n}` }));
    const data = await loadInbox(fakeRepo(many).repo, NOW, "UTC");
    expect(data.items).toHaveLength(INBOX_LIMIT);
    expect(data.full).toBe(true);
  });
});

describe("planItem", () => {
  it("plans for today and tomorrow by the user's own calendar, not the server's", async () => {
    const a = makeItem();
    const b = makeItem();
    const { repo, items } = fakeRepo([a, b]);

    expect(await planItem(repo, a.id, "today", NOW, "Pacific/Auckland")).toEqual({ ok: true });
    expect(await planItem(repo, b.id, "tomorrow", NOW, "Pacific/Auckland")).toEqual({ ok: true });

    expect(items[0].schedule).toEqual({ kind: "day", on: "2026-10-07" });
    expect(items[1].schedule).toEqual({ kind: "day", on: "2026-10-08" });
  });

  it("plans for a picked date, after which the item leaves the inbox", async () => {
    const item = makeItem();
    const { repo } = fakeRepo([item]);

    expect(await planItem(repo, item.id, "2026-11-02", NOW, "UTC")).toEqual({ ok: true });

    expect(item.schedule).toEqual({ kind: "day", on: "2026-11-02" });
    expect(await repo.listInbox()).toEqual([]);
  });

  it("never writes a schedule the client sent, or anything for a bad day or id", async () => {
    const item = makeItem();
    const { repo, calls } = fakeRepo([item]);
    const bad: [unknown, unknown][] = [
      [item.id, { kind: "timed", start: NOW, end: NOW }],
      [item.id, { kind: "day", on: "2026-10-08" }],
      [item.id, "Today"],
      [item.id, "2026-02-30"],
      [item.id, "tray"],
      [item.id, null],
      ["not-a-uuid", "today"],
    ];
    for (const [id, when] of bad) expect((await planItem(repo, id, when, NOW, "UTC")).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });

  it("refuses to plan a note", async () => {
    const note = makeItem({ type: "note" });
    const { repo, calls } = fakeRepo([note]);
    expect((await planItem(repo, note.id, "today", NOW, "UTC")).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });
});
