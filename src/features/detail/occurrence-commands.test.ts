import { describe, expect, it } from "vitest";
import type { Item, ItemId, LocalDate } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import type { Rule } from "@/domain/recurrence";
import { placeItem } from "@/features/score/commands";
import { setDone } from "@/features/today/commands";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { moveItem } from "@/features/week/commands";
import { loadOccurrences } from "@/lib/items/occurrences";
import { DATE_RANGE_ERROR } from "@/lib/dates";
import { clearTime, deleteItem, loadDetail, renameItem, restoreOccurrence, setFirstDay, setItemArea, setRepeat, setTime, stopRepeating } from "./commands";

const d = (s: string) => s as LocalDate;
const TZ = "UTC";
const NOW = new Date("2026-10-06T12:00:00Z");
const daily: Rule = { freq: "daily", interval: 1, end: { kind: "never" } };
const work = area("Work");
const home = area("Home");

function world(over: Partial<Item> = {}) {
  const series = makeItem({
    title: "Standup",
    areaId: work.id,
    schedule: { kind: "timed", start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T09:15:00Z") },
    recurrence: { kind: "series", rule: daily },
    ...over,
  });
  const fake = fakeRepo([series], [work, home]);
  const overrides = () => fake.items.filter((i) => i.recurrence.kind === "override");
  const shown = async (from: string, to: string) =>
    (await loadOccurrences(fake.repo, { from: new Date(0), to: new Date(0), fromDate: d(from), toDate: d(to) }, TZ)).occurrences.map(
      (o) => o.recurrence.originalOn,
    );
  return { series, ...fake, overrides, shown, key: (on: string) => occurrenceKey(series.id, d(on)) };
}

describe("per-occurrence writes", () => {
  it("setDone on an occurrence stores a done override and leaves the series open", async () => {
    const w = world();
    expect(await setDone(w.repo, w.key("2026-10-07"), true, TZ)).toEqual({ ok: true });
    expect(w.overrides()).toEqual([
      expect.objectContaining({ status: "done", recurrence: { kind: "override", seriesId: w.series.id, originalOn: "2026-10-07" } }),
    ]);
    expect(w.series.status).toBe("open");
    expect(await w.shown("2026-10-06", "2026-10-09")).toEqual(["2026-10-06", "2026-10-08"]);
  });

  it("doing it twice keeps one override", async () => {
    const w = world();
    await setDone(w.repo, w.key("2026-10-07"), true, TZ);
    await setDone(w.repo, w.key("2026-10-07"), false, TZ);
    expect(w.overrides()).toHaveLength(1);
    expect(w.overrides()[0].status).toBe("open");
  });

  it("refuses a date the series does not fall on, and writes nothing", async () => {
    const w = world({ recurrence: { kind: "series", rule: { ...daily, end: { kind: "count", count: 2 } } } });
    expect((await setDone(w.repo, w.key("2026-10-09"), true, TZ)).ok).toBe(false);
    expect((await setDone(w.repo, `${w.series.id}~2026-02-30`, true, TZ)).ok).toBe(false);
    expect(w.calls.create).toEqual([]);
    expect(w.calls.update).toEqual([]);
  });

  it("placing an occurrence moves only that day", async () => {
    const w = world();
    const start = new Date("2026-10-07T14:00:00Z");
    const end = new Date("2026-10-07T14:15:00Z");
    expect(await placeItem(w.repo, w.key("2026-10-07"), { schedule: { kind: "timed", start, end }, areaId: home.id }, TZ)).toEqual({
      ok: true,
    });
    expect(w.overrides()[0]).toMatchObject({ schedule: { kind: "timed", start, end }, areaId: home.id });
    expect(w.series.schedule).toEqual({ kind: "timed", start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T09:15:00Z") });
  });

  it("moving an occurrence to another day keeps its clock, and its own date stays suppressed", async () => {
    const w = world();
    expect(await moveItem(w.repo, w.key("2026-10-07"), "2026-10-10", TZ)).toEqual({ ok: true });
    expect(w.overrides()[0]).toMatchObject({
      schedule: { kind: "timed", start: new Date("2026-10-10T09:00:00Z"), end: new Date("2026-10-10T09:15:00Z") },
      recurrence: { originalOn: "2026-10-07" },
    });
    expect(await w.shown("2026-10-07", "2026-10-08")).toEqual([]);
  });

  it("rename and area change one occurrence, or all of them", async () => {
    const w = world();
    expect(await renameItem(w.repo, w.key("2026-10-07"), "Standup, short", TZ, "one")).toEqual({ ok: true });
    expect(w.overrides()[0].title).toBe("Standup, short");
    expect(w.series.title).toBe("Standup");

    expect(await renameItem(w.repo, w.key("2026-10-08"), "Daily standup", TZ, "all")).toEqual({ ok: true });
    expect(await setItemArea(w.repo, w.overrides()[0].id, home.id, TZ, "all")).toEqual({ ok: true });
    expect(w.series).toMatchObject({ title: "Daily standup", areaId: home.id });
    // "All of them" from an override includes the one in view, and no other override.
    expect(w.overrides()).toEqual([expect.objectContaining({ title: "Standup, short", areaId: home.id })]);
  });

  it("rejects an unknown scope", async () => {
    const w = world();
    expect((await renameItem(w.repo, w.key("2026-10-07"), "x", TZ, "every")).ok).toBe(false);
    expect(w.calls.update).toEqual([]);
  });
});

describe("delete and skip", () => {
  it("deleting one occurrence skips it, and it does not come back", async () => {
    const w = world();
    expect(await deleteItem(w.repo, w.key("2026-10-07"), TZ)).toEqual({ ok: true });
    expect(w.overrides()[0].status).toBe("dropped");
    expect(await w.shown("2026-10-07", "2026-10-08")).toEqual([]);
    expect(await deleteItem(w.repo, w.overrides()[0].id, TZ)).toEqual({ ok: true });
    expect(w.overrides()).toHaveLength(1);
    expect(await w.shown("2026-10-07", "2026-10-08")).toEqual([]);
  });

  it("deleting all of them removes the series and keeps the overrides", async () => {
    const w = world();
    await setDone(w.repo, w.key("2026-10-06"), true, TZ);
    expect(await deleteItem(w.repo, w.key("2026-10-07"), TZ, "all")).toEqual({ ok: true });
    expect(w.items.find((i) => i.id === w.series.id)).toBeUndefined();
    expect(w.overrides().map((o) => o.status)).toEqual(["done"]);
  });

  it("deleting all of them from an override takes that override too", async () => {
    const w = world();
    await setDone(w.repo, w.key("2026-10-06"), true, TZ);
    await renameItem(w.repo, w.key("2026-10-07"), "In view", TZ);
    const inView = w.overrides()[1];
    expect(await deleteItem(w.repo, inView.id, TZ, "all")).toEqual({ ok: true });
    expect(w.items.some((i) => i.id === w.series.id || i.id === inView.id)).toBe(false);
    expect(w.overrides().map((o) => o.status)).toEqual(["done"]);
  });
});

describe("restoreOccurrence", () => {
  it("brings a skipped occurrence back open, keeping what was changed on it", async () => {
    const w = world();
    await renameItem(w.repo, w.key("2026-10-07"), "Standup, short", TZ);
    await deleteItem(w.repo, w.key("2026-10-07"), TZ);
    expect(await restoreOccurrence(w.repo, w.key("2026-10-07"), TZ)).toEqual({ ok: true });
    expect(w.overrides()).toEqual([expect.objectContaining({ status: "open", title: "Standup, short" })]);
  });

  it("a second restore changes nothing and still succeeds", async () => {
    const w = world();
    await deleteItem(w.repo, w.key("2026-10-07"), TZ);
    await restoreOccurrence(w.repo, w.key("2026-10-07"), TZ);
    const writes = w.calls.update.length;
    expect(await restoreOccurrence(w.repo, w.key("2026-10-07"), TZ)).toEqual({ ok: true });
    expect(w.calls.update).toHaveLength(writes);
    expect(w.overrides()).toHaveLength(1);
  });

  it("refuses one never skipped, one done, a stored id, a gone series and nonsense, and writes nothing", async () => {
    const w = world();
    await setDone(w.repo, w.key("2026-10-08"), true, TZ);
    await deleteItem(w.repo, w.key("2026-10-09"), TZ);
    const [, skipped] = w.overrides();
    const writes = w.calls.update.length;
    const refused = ["That one was not skipped.", "That one was not skipped.", "That item is not here any more."];
    for (const [i, key] of [w.key("2026-10-07"), w.key("2026-10-08"), skipped.id].entries()) {
      expect(await restoreOccurrence(w.repo, key, TZ)).toEqual({ ok: false, error: refused[i] });
    }
    for (const bad of [null, "", `${w.series.id}~2026-02-30`]) expect((await restoreOccurrence(w.repo, bad, TZ)).ok).toBe(false);
    await deleteItem(w.repo, w.series.id, TZ);
    expect((await restoreOccurrence(w.repo, w.key("2026-10-09"), TZ)).ok).toBe(false);
    expect(w.calls.update).toHaveLength(writes);
    expect(skipped.status).toBe("dropped");
  });

  it("the series' panel lists its skipped dates in order, each with the key that restores it", async () => {
    const w = world();
    await deleteItem(w.repo, w.key("2027-01-04"), TZ);
    await deleteItem(w.repo, w.key("2026-10-09"), TZ);
    await setDone(w.repo, w.key("2026-10-08"), true, TZ);
    const view = await loadDetail(w.repo, { kind: "item", id: w.series.id as ItemId }, NOW, TZ);
    expect(view?.repeat).toMatchObject({
      kind: "series",
      skipped: [
        { key: w.key("2026-10-09"), on: "Friday 9 October" },
        { key: w.key("2027-01-04"), on: "Monday 4 January 2027" },
      ],
    });
    await restoreOccurrence(w.repo, w.key("2026-10-09"), TZ);
    const after = await loadDetail(w.repo, { kind: "item", id: w.series.id as ItemId }, NOW, TZ);
    expect(after?.repeat).toMatchObject({ skipped: [{ key: w.key("2027-01-04") }] });
  });

  it("a skipped occurrence's own panel names the key that restores it, opened by its key or its stored id", async () => {
    const w = world();
    await deleteItem(w.repo, w.key("2026-10-09"), TZ);
    const restoring = { key: w.key("2026-10-09"), on: "Friday 9 October" };
    const byKey = await loadDetail(w.repo, { kind: "occurrence", seriesId: w.series.id as ItemId, originalOn: d("2026-10-09") }, NOW, TZ);
    const byId = await loadDetail(w.repo, { kind: "item", id: w.overrides()[0].id as ItemId }, NOW, TZ);
    expect(byKey?.repeat).toMatchObject({ kind: "occurrence", skipped: restoring });
    expect(byId?.repeat).toMatchObject({ kind: "occurrence", skipped: restoring });
    const open = await loadDetail(w.repo, { kind: "occurrence", seriesId: w.series.id as ItemId, originalOn: d("2026-10-08") }, NOW, TZ);
    expect(open?.repeat).toMatchObject({ kind: "occurrence", skipped: null });
  });
});

describe("setRepeat", () => {
  const eligible = () => makeItem({ type: "checklist", schedule: { kind: "day", on: d("2026-10-06") } });

  it("starts a series from the item's own day", async () => {
    const item = eligible();
    const { repo } = fakeRepo([item]);
    expect(await setRepeat(repo, item.id, { preset: "weekdays", end: { kind: "count", count: 10 } }, new Date(), TZ)).toEqual({ ok: true });
    expect(item.recurrence).toEqual({
      kind: "series",
      rule: { freq: "weekly", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"], end: { kind: "count", count: 10 } },
    });
  });

  it("moves an item to its first occurrence when its own day is not one, keeping its time", async () => {
    const item = makeItem({ schedule: { kind: "timed", start: new Date("2026-10-10T09:00:00Z"), end: new Date("2026-10-10T09:30:00Z") } });
    const { repo } = fakeRepo([item]);
    expect(await setRepeat(repo, item.id, { preset: "weekdays" }, NOW, TZ)).toEqual({ ok: true });
    expect(item.schedule).toEqual({ kind: "timed", start: new Date("2026-10-12T09:00:00Z"), end: new Date("2026-10-12T09:30:00Z") });
    const span = { from: new Date(0), to: new Date(0), fromDate: d("2026-10-10"), toDate: d("2026-10-13") };
    expect((await loadOccurrences(repo, span, TZ)).occurrences.map((o) => o.recurrence.kind === "occurrence" && o.recurrence.originalOn)).toEqual([
      "2026-10-12",
    ]);
  });

  it("starts an unscheduled item repeating from today", async () => {
    const item = makeItem();
    const { repo } = fakeRepo([item]);
    await setRepeat(repo, item.id, { preset: "daily" }, new Date("2026-10-06T23:30:00Z"), "Asia/Kolkata");
    expect(item.schedule).toEqual({ kind: "day", on: "2026-10-07" });
    expect(item.recurrence.kind).toBe("series");
  });

  it("refuses notes, subtasks and parents, and writes nothing", async () => {
    const note = makeItem({ type: "note" });
    const parent = eligible();
    const child = makeItem({ parentId: parent.id });
    const { repo, calls } = fakeRepo([note, parent, child]);
    for (const it of [note, parent, child]) {
      expect((await setRepeat(repo, it.id, { preset: "daily" }, new Date(), TZ)).ok).toBe(false);
    }
    expect(calls.update).toEqual([]);
  });

  it("refuses a choice outside the menu and an end before the start", async () => {
    const item = eligible();
    const { repo, calls } = fakeRepo([item]);
    for (const bad of [{ preset: "hourly" }, { preset: "daily", end: { kind: "count", count: 0 } }, "FREQ=DAILY", null]) {
      expect((await setRepeat(repo, item.id, bad, new Date(), TZ)).ok).toBe(false);
    }
    expect((await setRepeat(repo, item.id, { preset: "daily", end: { kind: "until", on: "2026-10-05" } }, new Date(), TZ)).ok).toBe(false);
    expect(await setRepeat(repo, item.id, { preset: "daily", end: { kind: "until", on: "9999-12-31" } }, new Date(), TZ)).toEqual({
      ok: false,
      error: DATE_RANGE_ERROR,
    });
    expect(calls.update).toEqual([]);
  });

  it("on an occurrence, changes the whole series", async () => {
    const w = world();
    await setRepeat(w.repo, w.key("2026-10-07"), { preset: "biweekly" }, new Date(), TZ);
    expect(w.series.recurrence).toEqual({ kind: "series", rule: { freq: "weekly", interval: 2, byDay: [], end: { kind: "never" } } });
  });

  it("turning it off detaches overrides first, then leaves one item", async () => {
    const w = world();
    await setDone(w.repo, w.key("2026-10-07"), true, TZ);
    expect(await setRepeat(w.repo, w.series.id, { preset: "none" }, new Date(), TZ)).toEqual({ ok: true });
    const order = w.calls.update.map(([id, patch]) => [id === w.series.id ? "series" : "override", patch.recurrence?.kind]);
    expect(order.slice(-2)).toEqual([
      ["override", "none"],
      ["series", "none"],
    ]);
    expect(await w.shown("2026-10-05", "2026-10-10")).toEqual([]);
  });
});

describe("setTime", () => {
  const anyTime = () => world({ schedule: { kind: "day", on: d("2026-10-06") } });
  const timed = (start: string, end: string) => ({ kind: "timed", start: new Date(start), end: new Date(end) });

  it("gives a day-only series a time on its own first date, after one occurrence was dragged", async () => {
    const w = anyTime();
    const at14 = timed("2026-10-06T14:00:00Z", "2026-10-06T15:00:00Z");
    await placeItem(w.repo, w.key("2026-10-06"), { schedule: at14 }, TZ);
    expect(await setTime(w.repo, w.key("2026-10-06"), { start: 14 * 60, length: 60 }, TZ, "all")).toEqual({ ok: true });
    expect(w.series.schedule).toEqual(at14);
    const next = await loadOccurrences(w.repo, { from: new Date(0), to: new Date(0), fromDate: d("2026-10-07"), toDate: d("2026-10-09") }, TZ);
    expect(next.occurrences.map((o) => o.schedule)).toEqual([
      timed("2026-10-07T14:00:00Z", "2026-10-07T15:00:00Z"),
      timed("2026-10-08T14:00:00Z", "2026-10-08T15:00:00Z"),
    ]);
  });

  it("from a later occurrence, keeps the series' first date", async () => {
    const w = world();
    expect(await setTime(w.repo, w.key("2026-10-09"), { start: 7 * 60 + 30, length: 45 }, TZ, "all")).toEqual({ ok: true });
    expect(w.series.schedule).toEqual(timed("2026-10-05T07:30:00Z", "2026-10-05T08:15:00Z"));
    expect(w.overrides()).toEqual([]);
  });

  it("leaves other overrides alone, and moves the one it was changed from", async () => {
    const w = world();
    await renameItem(w.repo, w.key("2026-10-07"), "Kept", TZ);
    await renameItem(w.repo, w.key("2026-10-08"), "In view", TZ);
    const [kept, inView] = w.overrides();
    const before = structuredClone(kept);
    expect(await setTime(w.repo, inView.id, { start: 16 * 60, length: 30 }, TZ, "all")).toEqual({ ok: true });
    expect(kept).toEqual(before);
    expect(inView.schedule).toEqual(timed("2026-10-08T16:00:00Z", "2026-10-08T16:30:00Z"));
    expect(w.series.schedule).toEqual(timed("2026-10-05T16:00:00Z", "2026-10-05T16:30:00Z"));
  });

  it("with scope one, times that occurrence only", async () => {
    const w = anyTime();
    expect(await setTime(w.repo, w.key("2026-10-08"), { start: 9 * 60, length: 30 }, TZ, "one")).toEqual({ ok: true });
    expect(w.overrides()[0].schedule).toEqual(timed("2026-10-08T09:00:00Z", "2026-10-08T09:30:00Z"));
    expect(w.series.schedule).toEqual({ kind: "day", on: "2026-10-06" });
  });

  it("keeps the wall clock across daylight saving, on the series' own date", async () => {
    const ny = "America/New_York";
    // Starts on a Saturday in EST; set from Monday's occurrence, which is in EDT.
    const w = world({ schedule: { kind: "day", on: d("2026-03-07") } });
    expect(await setTime(w.repo, w.key("2026-03-09"), { start: 9 * 60, length: 30 }, ny, "all")).toEqual({ ok: true });
    expect(w.series.schedule).toEqual(timed("2026-03-07T14:00:00Z", "2026-03-07T14:30:00Z"));
    const span = { from: new Date(0), to: new Date(0), fromDate: d("2026-03-09"), toDate: d("2026-03-10") };
    expect((await loadOccurrences(w.repo, span, ny)).occurrences[0].schedule).toEqual(timed("2026-03-09T13:00:00Z", "2026-03-09T13:30:00Z"));
  });

  it("refuses a time the clocks skip on the series' own date", async () => {
    const w = world({ schedule: { kind: "day", on: d("2026-03-08") } });
    expect(await setTime(w.repo, w.series.id, { start: 2 * 60 + 30, length: 60 }, "America/New_York", "all")).toEqual({
      ok: false,
      error: "02:30 does not happen on Sunday 8 March, when the clocks go forward. Try 03:00.",
    });
    expect(w.series.schedule).toEqual({ kind: "day", on: "2026-03-08" });
  });

  it("keeps the typed length on every other day when the series starts on the day the clocks go back", async () => {
    const ny = "America/New_York";
    const w = world({ schedule: { kind: "day", on: d("2026-11-01") } });
    expect(await setTime(w.repo, w.series.id, { start: 0, length: 4 * 60 }, ny, "all")).toEqual({ ok: true });
    const span = { from: new Date(0), to: new Date(0), fromDate: d("2026-11-02"), toDate: d("2026-11-03") };
    expect((await loadOccurrences(w.repo, span, ny)).occurrences[0].schedule).toEqual(timed("2026-11-02T05:00:00Z", "2026-11-02T09:00:00Z"));
  });

  it("keeps a typed end on the wall clock when the series starts on the night the clocks go forward, and every day after", async () => {
    const ny = "America/New_York";
    const w = world({ schedule: { kind: "day", on: d("2026-03-08") } });
    expect(await setTime(w.repo, w.series.id, { start: 90, length: 150 }, ny, "all")).toEqual({ ok: true });
    // 01:30 EST to 04:00 EDT is 90 real minutes.
    expect(w.series.schedule).toEqual(timed("2026-03-08T06:30:00Z", "2026-03-08T08:00:00Z"));
    const span = { from: new Date(0), to: new Date(0), fromDate: d("2026-03-08"), toDate: d("2026-03-10") };
    expect((await loadOccurrences(w.repo, span, ny)).occurrences.map((o) => o.schedule)).toEqual([
      timed("2026-03-08T06:30:00Z", "2026-03-08T08:00:00Z"),
      timed("2026-03-09T05:30:00Z", "2026-03-09T08:00:00Z"),
    ]);
  });

  it("refuses an end the clocks skip on the series' own date", async () => {
    const w = world({ schedule: { kind: "day", on: d("2026-03-08") } });
    expect(await setTime(w.repo, w.series.id, { start: 60, length: 90 }, "America/New_York", "all")).toEqual({
      ok: false,
      error: "02:30 does not happen on Sunday 8 March, when the clocks go forward. Try 03:00.",
    });
    expect(w.series.schedule).toEqual({ kind: "day", on: "2026-03-08" });
  });

  it("refuses all of them for something that does not repeat, and writes nothing", async () => {
    const plain = makeItem({ schedule: { kind: "day", on: d("2026-10-06") } });
    const orphan = makeItem({ recurrence: { kind: "override", seriesId: plain.id, originalOn: d("2026-10-06") } });
    const { repo, calls } = fakeRepo([plain, orphan]);
    expect(await setTime(repo, plain.id, { start: 600, length: 30 }, TZ, "all")).toEqual({ ok: false, error: "That does not repeat." });
    expect((await setTime(repo, orphan.id, { start: 600, length: 30 }, TZ, "all")).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });

  it("refuses instants, out-of-range minutes and unknown scopes", async () => {
    const w = anyTime();
    const bad = [
      { start: new Date("2026-10-06T14:00:00Z"), length: 60 },
      { start: 1440, length: 30 },
      { start: 600, length: 0 },
      { start: 600.5, length: 30 },
      null,
    ];
    for (const time of bad) expect((await setTime(w.repo, w.key("2026-10-06"), time, TZ, "all")).ok).toBe(false);
    expect((await setTime(w.repo, w.key("2026-10-06"), { start: 600, length: 30 }, TZ, "every")).ok).toBe(false);
    expect(w.calls.update).toEqual([]);
    expect(w.calls.create).toEqual([]);
  });
});

describe("clearTime", () => {
  it("with scope all, puts the series back to any time on its first date, and the override it was changed from on its own", async () => {
    const w = world();
    await renameItem(w.repo, w.key("2026-10-07"), "Kept", TZ);
    await renameItem(w.repo, w.key("2026-10-08"), "In view", TZ);
    const [kept, inView] = w.overrides();
    const before = structuredClone(kept);
    expect(await clearTime(w.repo, inView.id, TZ, "all")).toEqual({ ok: true });
    expect(w.series.schedule).toEqual({ kind: "day", on: "2026-10-05" });
    expect(inView.schedule).toEqual({ kind: "day", on: "2026-10-08" });
    expect(kept).toEqual(before);
    const next = await loadOccurrences(w.repo, { from: new Date(0), to: new Date(0), fromDate: d("2026-10-09"), toDate: d("2026-10-10") }, TZ);
    expect(next.occurrences.map((o) => o.schedule)).toEqual([{ kind: "day", on: "2026-10-09" }]);
  });

  it("from the series itself, changes the series and no override", async () => {
    const w = world();
    await renameItem(w.repo, w.key("2026-10-07"), "Kept", TZ);
    const before = structuredClone(w.overrides());
    expect(await clearTime(w.repo, w.series.id, TZ, "all")).toEqual({ ok: true });
    expect(w.series.schedule).toEqual({ kind: "day", on: "2026-10-05" });
    expect(await setTime(w.repo, w.series.id, { start: 7 * 60, length: 20 }, TZ, "all")).toEqual({ ok: true });
    expect(w.series.schedule).toEqual({ kind: "timed", start: new Date("2026-10-05T07:00:00Z"), end: new Date("2026-10-05T07:20:00Z") });
    expect(w.overrides()).toEqual(before);
  });

  it("with scope one, clears that occurrence only", async () => {
    const w = world();
    expect(await clearTime(w.repo, w.key("2026-10-08"), TZ, "one")).toEqual({ ok: true });
    expect(w.overrides()[0].schedule).toEqual({ kind: "day", on: "2026-10-08" });
    expect(w.series.schedule.kind).toBe("timed");
  });

  it("refuses all of them for something that does not repeat, and an unknown scope", async () => {
    const plain = makeItem({ schedule: { kind: "day", on: d("2026-10-06") } });
    const { repo, calls } = fakeRepo([plain]);
    expect(await clearTime(repo, plain.id, TZ, "all")).toEqual({ ok: false, error: "That does not repeat." });
    expect((await clearTime(repo, plain.id, TZ, "every")).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });
});

describe("setFirstDay", () => {
  const timed = (start: string, end: string) => ({ kind: "timed" as const, start: new Date(start), end: new Date(end) });

  it("moves a timed series to a new first date at the same time, from any occurrence", async () => {
    const w = world();
    expect(await setFirstDay(w.repo, w.key("2026-10-09"), "2026-10-12", TZ)).toEqual({ ok: true });
    expect(w.series.schedule).toEqual(timed("2026-10-12T09:00:00Z", "2026-10-12T09:15:00Z"));
    expect(await w.shown("2026-10-05", "2026-10-13")).toEqual(["2026-10-12"]);
    expect(w.overrides()).toEqual([]);
  });

  it("moves a day-only series earlier", async () => {
    const w = world({ schedule: { kind: "day", on: d("2026-10-06") } });
    expect(await setFirstDay(w.repo, w.series.id, "2026-10-01", TZ)).toEqual({ ok: true });
    expect(w.series.schedule).toEqual({ kind: "day", on: "2026-10-01" });
  });

  it("leaves every override alone, the one it was changed from included", async () => {
    const w = world();
    await renameItem(w.repo, w.key("2026-10-07"), "Kept", TZ);
    const before = structuredClone(w.overrides());
    expect(await setFirstDay(w.repo, w.overrides()[0].id, "2026-10-06", TZ)).toEqual({ ok: true });
    expect(w.overrides()).toEqual(before);
    expect(w.series.schedule).toEqual(timed("2026-10-06T09:00:00Z", "2026-10-06T09:15:00Z"));
  });

  it("keeps the wall clock across daylight saving", async () => {
    const ny = "America/New_York";
    // 09:00 EST on Saturday 7 March; Monday 9 March is in EDT.
    const w = world({ schedule: timed("2026-03-07T14:00:00Z", "2026-03-07T14:30:00Z") });
    expect(await setFirstDay(w.repo, w.series.id, "2026-03-09", ny)).toEqual({ ok: true });
    expect(w.series.schedule).toEqual(timed("2026-03-09T13:00:00Z", "2026-03-09T13:30:00Z"));
  });

  it("keeps the start and end on the wall clock when the new first date is the night the clocks go forward", async () => {
    const ny = "America/New_York";
    // 01:00 to 04:00 EST on Saturday 7 March, three real hours.
    const w = world({ schedule: timed("2026-03-07T06:00:00Z", "2026-03-07T09:00:00Z") });
    expect(await setFirstDay(w.repo, w.series.id, "2026-03-08", ny)).toEqual({ ok: true });
    // 01:00 EST to 04:00 EDT on Sunday, two real hours.
    expect(w.series.schedule).toEqual(timed("2026-03-08T06:00:00Z", "2026-03-08T08:00:00Z"));
  });

  it("refuses a first date after the series ends, bad dates and things that do not repeat, and writes nothing", async () => {
    const w = world({ recurrence: { kind: "series", rule: { ...daily, end: { kind: "until", on: d("2026-10-10") } } } });
    expect(await setFirstDay(w.repo, w.series.id, "2026-10-11", TZ)).toEqual({ ok: false, error: "The end date is before it first happens." });
    for (const bad of ["2026-02-30", "2026-10-11T00:00:00Z", new Date("2026-10-11"), null]) {
      expect((await setFirstDay(w.repo, w.series.id, bad, TZ)).ok).toBe(false);
    }
    expect(await setFirstDay(w.repo, w.series.id, "1969-12-31", TZ)).toEqual({ ok: false, error: DATE_RANGE_ERROR });
    const plain = makeItem({ schedule: { kind: "day", on: d("2026-10-06") } });
    w.items.push(plain);
    expect(await setFirstDay(w.repo, plain.id, "2026-10-07", TZ)).toEqual({ ok: false, error: "That does not repeat." });
    expect(w.calls.update).toEqual([]);
    expect(w.calls.create).toEqual([]);
  });
});

describe("stopRepeating", () => {
  it("ends the series the day before, and clears later overrides that are not done", async () => {
    const w = world();
    await setDone(w.repo, w.key("2026-10-09"), true, TZ);
    await renameItem(w.repo, w.key("2026-10-10"), "Moved", TZ);
    expect(await stopRepeating(w.repo, w.key("2026-10-08"), TZ)).toEqual({ ok: true });
    expect(w.series.recurrence).toEqual({ kind: "series", rule: { ...daily, end: { kind: "until", on: "2026-10-07" } } });
    expect(w.overrides().map((o) => [o.recurrence.kind === "override" && o.recurrence.originalOn, o.status])).toEqual([["2026-10-09", "done"]]);
    expect(await w.shown("2026-10-05", "2026-10-12")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
  });

  it("from the first occurrence, deletes the series", async () => {
    const w = world();
    expect(await stopRepeating(w.repo, w.key("2026-10-05"), TZ)).toEqual({ ok: true });
    expect(w.items.find((i) => i.id === w.series.id)).toBeUndefined();
  });

  it("never moves an earlier end later", async () => {
    const w = world({ recurrence: { kind: "series", rule: { ...daily, end: { kind: "until", on: d("2026-10-06") } } } });
    // Left over from before the rule was shortened.
    const override = makeItem({ recurrence: { kind: "override", seriesId: w.series.id, originalOn: d("2026-10-09") } });
    w.items.push(override);
    await stopRepeating(w.repo, override.id, TZ);
    expect(w.series.recurrence).toEqual({ kind: "series", rule: { ...daily, end: { kind: "until", on: "2026-10-06" } } });
  });

  it("refuses something that does not repeat", async () => {
    const plain = makeItem({ schedule: { kind: "day", on: d("2026-10-06") } });
    const { repo, calls } = fakeRepo([plain]);
    expect((await stopRepeating(repo, plain.id, TZ)).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });
});

describe("loadDetail for repeating items", () => {
  it("shows a virtual occurrence with its day, rule and the series as the notes target", async () => {
    const w = world();
    const view = await loadDetail(w.repo, { kind: "occurrence", seriesId: w.series.id, originalOn: d("2026-10-07") }, NOW, TZ);
    expect(view).toMatchObject({
      item: { id: w.key("2026-10-07"), title: "Standup", done: false },
      when: "Wednesday 7 October, 09:00 to 09:15",
      time: { start: 9 * 60, length: 15 },
      repeat: { kind: "occurrence", preset: "daily", summary: "Every day", on: "Wednesday 7 October" },
      notesFor: w.series.id,
      nesting: { kind: "no-subtasks" },
    });
    expect(w.calls.create).toEqual([]);
  });

  it("an occurrence key opens its override once there is one", async () => {
    const w = world();
    await renameItem(w.repo, w.key("2026-10-07"), "Short one", TZ);
    const view = await loadDetail(w.repo, { kind: "occurrence", seriesId: w.series.id, originalOn: d("2026-10-07") }, NOW, TZ);
    expect(view?.item).toMatchObject({ id: w.overrides()[0].id, title: "Short one" });
    expect(view?.repeat.kind).toBe("occurrence");
    expect(view?.notesFor).toBe(w.series.id);
  });

  it("shows the series' tags on an occurrence and its override, and every tag most used first", async () => {
    const w = world();
    const other = makeItem({ title: "Loose" });
    w.items.push(other);
    w.tag(w.series.id, "work", "Daily");
    w.tag(other.id, "home");
    const occurrence = { kind: "occurrence" as const, seriesId: w.series.id, originalOn: d("2026-10-07") };
    expect((await loadDetail(w.repo, occurrence, NOW, TZ))?.tags).toEqual({ on: ["Daily", "work"], known: ["Daily", "home", "work"] });
    await renameItem(w.repo, w.key("2026-10-07"), "Short one", TZ);
    expect((await loadDetail(w.repo, occurrence, NOW, TZ))?.tags.on).toEqual(["Daily", "work"]);
    w.tag(other.id, "work");
    expect((await loadDetail(w.repo, { kind: "item", id: other.id as ItemId }, NOW, TZ))?.tags).toEqual({
      on: ["home", "work"],
      known: ["work", "Daily", "home"],
    });
  });

  it("offers repeat only where it is allowed", async () => {
    const parent = makeItem({ type: "task" });
    const child = makeItem({ parentId: parent.id });
    const note = makeItem({ type: "note" });
    const lone = makeItem({ type: "event" });
    const { repo } = fakeRepo([parent, child, note, lone]);
    const repeatOf = async (i: Item) => (await loadDetail(repo, { kind: "item", id: i.id as ItemId }, NOW, TZ))?.repeat.kind;
    expect(await repeatOf(parent)).toBe("unavailable");
    expect(await repeatOf(child)).toBe("unavailable");
    expect(await repeatOf(note)).toBe("hidden");
    expect(await repeatOf(lone)).toBe("off");
  });
});
