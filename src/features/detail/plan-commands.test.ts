import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { planItem } from "@/features/inbox/commands";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { moveItem } from "@/features/week/commands";
import { DATE_RANGE_ERROR } from "@/lib/dates";
import { clearTime, loadDetail, setDue, setTime, setType } from "./commands";
import { describeWhen } from "./model";

describe("setDue", () => {
  it("sets a due date from a local date and clears it, writing once when nothing changes", async () => {
    const task = makeItem();
    const { repo, calls } = fakeRepo([task]);
    expect(await setDue(repo, task.id, "2026-10-12")).toEqual({ ok: true });
    expect(task.dueOn).toBe("2026-10-12");
    expect(await setDue(repo, task.id, "2026-10-12")).toEqual({ ok: true });
    expect(await setDue(repo, task.id, null)).toEqual({ ok: true });
    expect(task.dueOn).toBeNull();
    expect(calls.update).toEqual([
      [task.id, { dueOn: "2026-10-12" }],
      [task.id, { dueOn: null }],
    ]);
  });

  it("refuses an unreadable date, an instant, a note, an event and anything that repeats", async () => {
    const task = makeItem();
    const note = makeItem({ type: "note" });
    const event = makeItem({ type: "event" });
    const series = makeItem({
      schedule: { kind: "day", on: "2026-10-05" as LocalDate },
      recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
    });
    const { repo, calls } = fakeRepo([task, note, event, series]);

    for (const bad of ["2026-02-30", "2026-10-12T00:00:00Z", "", 20261012, undefined]) {
      expect(await setDue(repo, task.id, bad)).toEqual({ ok: false, error: "That date is not one Axiis can use." });
    }
    for (const far of ["9999-12-31", "1969-12-31"]) {
      expect(await setDue(repo, task.id, far)).toEqual({ ok: false, error: DATE_RANGE_ERROR });
      expect(await planItem(repo, task.id, far, new Date("2026-10-06T12:00:00Z"), "UTC")).toEqual({ ok: false, error: DATE_RANGE_ERROR });
    }
    const refused = { ok: false, error: "Only a task or checklist that does not repeat has a due date." };
    for (const id of [note.id, event.id, series.id]) expect(await setDue(repo, id, "2026-10-12")).toEqual(refused);
    expect(await setDue(repo, occurrenceKey(series.id, "2026-10-07" as LocalDate), "2026-10-12")).toEqual({
      ok: false,
      error: "That item is not here any more.",
    });
    expect(calls.update).toEqual([]);
  });
});

describe("setType", () => {
  const daily = { freq: "daily", interval: 1, end: { kind: "never" } } as const;

  it("makes a task an event and back, and a checklist, writing nothing when it already is one", async () => {
    const task = makeItem();
    const { repo, calls } = fakeRepo([task]);
    expect(await setType(repo, task.id, "event", "UTC")).toEqual({ ok: true });
    expect(task.type).toBe("event");
    expect(await setType(repo, task.id, "checklist", "UTC")).toEqual({ ok: true });
    expect(task.type).toBe("checklist");
    expect(await setType(repo, task.id, "checklist", "UTC")).toEqual({ ok: true });
    expect(calls.update).toEqual([
      [task.id, { type: "event" }],
      [task.id, { type: "checklist" }],
    ]);
  });

  it("changes the series and every override from an occurrence, untouched or stored", async () => {
    const series = makeItem({ schedule: { kind: "day", on: d("2026-10-05") }, recurrence: { kind: "series", rule: daily } });
    const override = makeItem({
      schedule: { kind: "day", on: d("2026-10-07") },
      status: "done",
      recurrence: { kind: "override", seriesId: series.id, originalOn: d("2026-10-07") },
    });
    const { repo, items } = fakeRepo([series, override]);

    expect(await setType(repo, occurrenceKey(series.id, d("2026-10-09")), "event", "UTC")).toEqual({ ok: true });
    expect([series.type, override.type]).toEqual(["event", "event"]);
    // Nothing is stored for the occurrence it was changed from.
    expect(items).toHaveLength(2);

    expect(await setType(repo, override.id, "checklist", "UTC")).toEqual({ ok: true });
    expect([series.type, override.type]).toEqual(["checklist", "checklist"]);
  });

  it("refuses a note, a subtask, an event that holds subtasks, and a type it does not know", async () => {
    const note = makeItem({ type: "note" });
    const parent = makeItem();
    const child = makeItem({ parentId: parent.id });
    const { repo, calls } = fakeRepo([note, parent, child]);

    expect(await setType(repo, note.id, "task", "UTC")).toEqual({ ok: false, error: "A note stays a note." });
    expect(await setType(repo, child.id, "checklist", "UTC")).toEqual({ ok: false, error: "A subtask stays a task." });
    expect(await setType(repo, parent.id, "event", "UTC")).toEqual({ ok: false, error: "Something with subtasks cannot be an event." });
    expect(await setType(repo, parent.id, "note", "UTC")).toEqual({ ok: false, error: "That type is not one Axiis knows." });
    expect(await setType(repo, "nope", "task", "UTC")).toEqual({ ok: false, error: "That item is not here any more." });
    expect(calls.update).toEqual([]);

    // A parent may still be a checklist.
    expect(await setType(repo, parent.id, "checklist", "UTC")).toEqual({ ok: true });
  });

  it("reports a failed save instead of throwing", async () => {
    const task = makeItem();
    const { repo } = fakeRepo([task]);
    repo.update = async () => {
      throw new Error("network");
    };
    expect(await setType(repo, task.id, "event", "UTC")).toEqual({ ok: false, error: "That change did not save. Try again." });
  });
});

const d = (s: string) => s as LocalDate;
const NY = "America/New_York";
const timed = (start: string, end: string) => ({ kind: "timed" as const, start: new Date(start), end: new Date(end) });

// The panel's When row plans with the Inbox's command, takes an item off its
// day with the week's, and times it with the detail commands.
describe("planning a one-off item from the panel", () => {
  it("plans a waiting task for tomorrow by the server's clock, then times it on the wall clock across a DST change", async () => {
    const task = makeItem();
    const { repo } = fakeRepo([task]);
    // 7 March in New York; tomorrow is the day the clocks go forward.
    const now = new Date("2026-03-07T15:00:00Z");

    expect(await planItem(repo, task.id, "tomorrow", now, NY)).toEqual({ ok: true });
    expect(task.schedule).toEqual({ kind: "day", on: d("2026-03-08") });

    expect(await setTime(repo, task.id, { start: 9 * 60, length: 30 }, NY)).toEqual({ ok: true });
    expect(task.schedule).toEqual(timed("2026-03-08T13:00:00Z", "2026-03-08T13:30:00Z"));
  });

  it("moves a timed task to another day keeping its clock across a DST change, and back to any time", async () => {
    const task = makeItem({ schedule: timed("2026-03-07T14:00:00Z", "2026-03-07T15:00:00Z") });
    const { repo } = fakeRepo([task]);

    expect(await planItem(repo, task.id, "2026-03-09", new Date("2026-03-07T15:00:00Z"), NY)).toEqual({ ok: true });
    expect(task.schedule).toEqual(timed("2026-03-09T13:00:00Z", "2026-03-09T14:00:00Z"));

    expect(await clearTime(repo, task.id, NY)).toEqual({ ok: true });
    expect(task.schedule).toEqual({ kind: "day", on: d("2026-03-09") });
  });

  it("keeps a typed end on the wall clock on the night the clocks go forward", async () => {
    const task = makeItem({ schedule: { kind: "day", on: d("2026-03-08") } });
    const { repo } = fakeRepo([task]);
    expect(await setTime(repo, task.id, { start: 90, length: 150 }, NY)).toEqual({ ok: true });
    // 01:30 EST to 04:00 EDT is 90 real minutes.
    expect(task.schedule).toEqual(timed("2026-03-08T06:30:00Z", "2026-03-08T08:00:00Z"));
    expect(describeWhen(task.schedule, NY)).toBe("Sunday 8 March, 01:30 to 04:00");
    expect((await loadDetail(repo, { kind: "item", id: task.id }, new Date("2026-03-07T15:00:00Z"), NY))?.time).toEqual({ start: 90, length: 150 });
  });

  it("keeps a typed end on the wall clock on the day the clocks go back", async () => {
    const task = makeItem({ schedule: { kind: "day", on: d("2026-11-01") } });
    const { repo } = fakeRepo([task]);
    expect(await setTime(repo, task.id, { start: 0, length: 23 * 60 + 59 }, NY)).toEqual({ ok: true });
    // 00:00 EDT to 23:59 EST is 25 hours less a minute.
    expect(task.schedule).toEqual(timed("2026-11-01T04:00:00Z", "2026-11-02T04:59:00Z"));
    expect(describeWhen(task.schedule, NY)).toBe("Sunday 1 November, 00:00 to 23:59");
  });

  it("refuses a start or an end the clocks skip, naming the first time that happens, and writes nothing", async () => {
    const task = makeItem({ schedule: { kind: "day", on: d("2026-03-08") } });
    const { repo, calls } = fakeRepo([task]);
    const skipped = { ok: false, error: "02:30 does not happen on Sunday 8 March, when the clocks go forward. Try 03:00." };
    expect(await setTime(repo, task.id, { start: 150, length: 60 }, NY)).toEqual(skipped);
    expect(await setTime(repo, task.id, { start: 60, length: 90 }, NY)).toEqual(skipped);
    expect(calls.update).toEqual([]);
  });

  it("takes a planned task off its day", async () => {
    const task = makeItem({ schedule: { kind: "day", on: d("2026-10-08") } });
    const { repo } = fakeRepo([task]);
    expect(await moveItem(repo, task.id, "tray", "UTC")).toEqual({ ok: true });
    expect(task.schedule).toEqual({ kind: "unscheduled" });
  });

  it("refuses a time before the item has a day, and a day for a note", async () => {
    const task = makeItem();
    const note = makeItem({ type: "note" });
    const { repo, calls } = fakeRepo([task, note]);
    expect(await setTime(repo, task.id, { start: 600, length: 30 }, "UTC")).toEqual({
      ok: false,
      error: "It needs a day before it can have a time.",
    });
    expect((await planItem(repo, note.id, "today", new Date(), "UTC")).ok).toBe(false);
    expect(await planItem(repo, task.id, "someday", new Date(), "UTC")).toEqual({
      ok: false,
      error: "That move did not save, so it is back where it was. Try again.",
    });
    expect(calls.update).toEqual([]);
  });

  it("moves one occurrence on its own, leaving the series where it was", async () => {
    const series = makeItem({
      schedule: timed("2026-10-05T09:00:00Z", "2026-10-05T09:15:00Z"),
      recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
    });
    const { repo, items } = fakeRepo([series]);
    const key = occurrenceKey(series.id, d("2026-10-07"));

    expect(await planItem(repo, key, "2026-10-09", new Date("2026-10-06T12:00:00Z"), "UTC")).toEqual({ ok: true });
    const override = items.find((i) => i.recurrence.kind === "override");
    expect(override?.schedule).toEqual(timed("2026-10-09T09:00:00Z", "2026-10-09T09:15:00Z"));
    expect(override?.recurrence).toEqual({ kind: "override", seriesId: series.id, originalOn: d("2026-10-07") });
    expect(series.schedule).toEqual(timed("2026-10-05T09:00:00Z", "2026-10-05T09:15:00Z"));
  });
});
