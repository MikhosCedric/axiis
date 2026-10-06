import { describe, expect, it } from "vitest";
import type { Item, LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { moveItem, MOVE_FAILED } from "./commands";

function setup(items: Item[]) {
  const fake = fakeRepo(items);
  const gets: unknown[] = [];
  const get = fake.repo.get;
  fake.repo.get = async (id) => {
    gets.push(id);
    return get(id);
  };
  return { ...fake, gets };
}

describe("moveItem", () => {
  it("moves a timed item to another day at the same local time", async () => {
    const item = makeItem({
      schedule: { kind: "timed", start: new Date("2026-10-23T08:00:00Z"), end: new Date("2026-10-23T09:30:00Z") },
    });
    const { repo, calls } = setup([item]);

    expect(await moveItem(repo, item.id, "2026-10-25", "Europe/London")).toEqual({ ok: true });

    expect(calls.update).toEqual([
      [
        item.id,
        { schedule: { kind: "timed", start: new Date("2026-10-25T09:00:00Z"), end: new Date("2026-10-25T10:30:00Z") } },
      ],
    ]);
  });

  it("gives a waiting item the day, and sends a planned one back to the tray", async () => {
    const waiting = makeItem();
    const planned = makeItem({ schedule: { kind: "day", on: "2026-10-06" as LocalDate } });
    const { repo, items } = setup([waiting, planned]);

    expect(await moveItem(repo, waiting.id, "2026-10-08", "UTC")).toEqual({ ok: true });
    expect(await moveItem(repo, planned.id, "tray", "UTC")).toEqual({ ok: true });

    expect(items[0].schedule).toEqual({ kind: "day", on: "2026-10-08" });
    expect(items[1].schedule).toEqual({ kind: "unscheduled" });
  });

  it("never reaches the repo with a bad id or destination", async () => {
    const item = makeItem();
    const { repo, calls, gets } = setup([item]);
    const bad: [unknown, unknown][] = [
      ["not-a-uuid", "2026-10-08"],
      [42, "2026-10-08"],
      [item.id, "2026-02-30"],
      [item.id, "2026-10-08T00:00"],
      [item.id, "Tray"],
      [item.id, null],
      [item.id, { kind: "day", on: "2026-10-08" }],
    ];
    for (const [id, to] of bad) expect((await moveItem(repo, id, to, "UTC")).ok).toBe(false);
    expect(gets).toEqual([]);
    expect(calls.update).toEqual([]);
  });

  it("refuses an item that is missing or is a note", async () => {
    const note = makeItem({ type: "note" });
    const { repo, calls } = setup([note]);
    expect(await moveItem(repo, note.id, "2026-10-08", "UTC")).toEqual({ ok: false, error: "That item could not be found." });
    expect(await moveItem(repo, "00000000-0000-4000-8000-0000000fffff", "2026-10-08", "UTC")).toMatchObject({ ok: false });
    expect(calls.update).toEqual([]);
  });

  it("reports a failed save plainly", async () => {
    const item = makeItem();
    const { repo } = setup([item]);
    repo.update = async () => {
      throw new Error("network");
    };
    expect(await moveItem(repo, item.id, "2026-10-08", "UTC")).toEqual({ ok: false, error: MOVE_FAILED });
  });
});
