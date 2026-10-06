import { describe, expect, it } from "vitest";
import type { Item, ItemId, LocalDate } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import type { Rule } from "@/domain/recurrence";
import { placeItem } from "@/features/score/commands";
import { setDone } from "@/features/today/commands";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { moveItem } from "@/features/week/commands";
import { loadOccurrences } from "@/lib/items/occurrences";
import { clearTime, deleteItem, loadDetail, renameItem, setFirstDay, setItemArea, setRepeat, setTime, stopRepeating } from "./commands";

const d = (s: string) => s as LocalDate;
const TZ = "UTC";
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

  it("moves a time the clocks skip forward with them", async () => {
    const w = world({ schedule: { kind: "day", on: d("2026-03-08") } });
    expect(await setTime(w.repo, w.series.id, { start: 2 * 60 + 30, length: 60 }, "America/New_York", "all")).toEqual({ ok: true });
    // 02:30 does not exist that night, so it starts at 03:30 EDT and still lasts an hour.
    expect(w.series.schedule).toEqual(timed("2026-03-08T07:30:00Z", "2026-03-08T08:30:00Z"));
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

  it("refuses a first date after the series ends, bad dates and things that do not repeat, and writes nothing", async () => {
    const w = world({ recurrence: { kind: "series", rule: { ...daily, end: { kind: "until", on: d("2026-10-10") } } } });
    expect(await setFirstDay(w.repo, w.series.id, "2026-10-11", TZ)).toEqual({ ok: false, error: "The end date is before it first happens." });
    for (const bad of ["2026-02-30", "2026-10-11T00:00:00Z", new Date("2026-10-11"), null]) {
      expect((await setFirstDay(w.repo, w.series.id, bad, TZ)).ok).toBe(false);
    }
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
    const view = await loadDetail(w.repo, { kind: "occurrence", seriesId: w.series.id, originalOn: d("2026-10-07") }, TZ);
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
    const view = await loadDetail(w.repo, { kind: "occurrence", seriesId: w.series.id, originalOn: d("2026-10-07") }, TZ);
    expect(view?.item).toMatchObject({ id: w.overrides()[0].id, title: "Short one" });
    expect(view?.repeat.kind).toBe("occurrence");
    expect(view?.notesFor).toBe(w.series.id);
  });

  it("offers repeat only where it is allowed", async () => {
    const parent = makeItem({ type: "task" });
    const child = makeItem({ parentId: parent.id });
    const note = makeItem({ type: "note" });
    const lone = makeItem({ type: "event" });
    const { repo } = fakeRepo([parent, child, note, lone]);
    const repeatOf = async (i: Item) => (await loadDetail(repo, { kind: "item", id: i.id as ItemId }, TZ))?.repeat.kind;
    expect(await repeatOf(parent)).toBe("unavailable");
    expect(await repeatOf(child)).toBe("unavailable");
    expect(await repeatOf(note)).toBe("hidden");
    expect(await repeatOf(lone)).toBe("off");
  });
});
