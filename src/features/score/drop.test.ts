import { describe, expect, it } from "vitest";
import type { AreaId, Item, LocalDate } from "@/domain/item";
import { area, makeItem } from "@/features/today/test-support";
import { dayRangeFor, instantAt, localMinutes } from "@/lib/dates";
import { anyTime, changes, keyPlacement, placeAt, resizeTo, unschedule, type DropContext, type Placement } from "./drop";
import { clamp, snap } from "./snap";

const date = "2026-10-06" as LocalDate;
const zone = "America/New_York";
const ctx: DropContext = { date, timeZone: zone, axis: { start: 420, end: 1200 }, now: null };
const at = (minutes: number, c = ctx) => instantAt(c.date, minutes, c.timeZone);
const timed = (start: number, end: number, over: Partial<Item> = {}, c = ctx) =>
  makeItem({ schedule: { kind: "timed", start: at(start, c), end: at(end, c) }, ...over });

/** The placement's times as local minutes, so expectations read like a clock. */
function minutes(p: Placement | null, c = ctx) {
  if (!p || p.schedule.kind !== "timed") return p?.schedule.kind ?? null;
  return [localMinutes(p.schedule.start, c.date, c.timeZone), localMinutes(p.schedule.end, c.date, c.timeZone)];
}

describe("snap", () => {
  it("rounds to the nearest quarter hour, halfway going later", () => {
    expect([snap(607), snap(608), snap(600), snap(-8)]).toEqual([600, 615, 600, -15]);
  });

  it("clamps, with the lower bound winning when the range is empty", () => {
    expect([clamp(5, 0, 10), clamp(-1, 0, 10), clamp(11, 0, 10), clamp(5, 8, 2)]).toEqual([5, 0, 10, 8]);
  });
});

describe("placeAt", () => {
  const work = area("Work").id;

  it("gives an unscheduled item thirty minutes at the snapped pointer time on the target area", () => {
    const p = placeAt(ctx, makeItem(), work, 10 * 60 + 8);
    expect(minutes(p)).toEqual([615, 645]);
    expect(p.areaId).toBe(work);
  });

  it("keeps a timed item's length when it moves", () => {
    expect(minutes(placeAt(ctx, timed(600, 690), null, 13 * 60 + 2))).toEqual([780, 870]);
  });

  it("holds the item inside the axis at both edges", () => {
    expect(minutes(placeAt(ctx, makeItem(), null, 300))).toEqual([420, 450]);
    expect(minutes(placeAt(ctx, timed(600, 690), null, 1190))).toEqual([1110, 1200]);
  });

  it("pins an item longer than the axis to the axis", () => {
    const short: DropContext = { ...ctx, axis: { start: 420, end: 480 } };
    expect(minutes(placeAt(short, timed(420, 600, {}, short), null, 450), short)).toEqual([420, 480]);
  });

  it("never lets a move carry an item past midnight", () => {
    const wide: DropContext = { ...ctx, axis: { start: 0, end: 1440 } };
    expect(minutes(placeAt(wide, timed(600, 720, {}, wide), null, 1430), wide)).toEqual([1320, 1440]);
  });

  it("builds times from the local clock on the spring-forward day", () => {
    const spring: DropContext = { ...ctx, date: "2026-03-08" as LocalDate };
    const p = placeAt(spring, makeItem(), null, 9 * 60);
    expect(p.schedule).toEqual({
      kind: "timed",
      start: new Date("2026-03-08T13:00:00Z"),
      end: new Date("2026-03-08T13:30:00Z"),
    });
  });

  it("builds times from the local clock on the fall-back day", () => {
    const fall: DropContext = { ...ctx, date: "2026-11-01" as LocalDate };
    const p = placeAt(fall, makeItem(), null, 9 * 60);
    expect(p.schedule).toEqual({
      kind: "timed",
      start: new Date("2026-11-01T14:00:00Z"),
      end: new Date("2026-11-01T14:30:00Z"),
    });
  });

  it("keeps the wall-clock length when moving across the fall-back hour", () => {
    const fall: DropContext = { ...ctx, date: "2026-11-01" as LocalDate, axis: { start: 0, end: 1440 } };
    const p = placeAt(fall, timed(9 * 60, 11 * 60, {}, fall), null, 60);
    expect(minutes(p, fall)).toEqual([60, 180]);
    if (p.schedule.kind !== "timed") throw new Error("expected timed");
    expect(p.schedule.end.getTime() - p.schedule.start.getTime()).toBe(3 * 3_600_000);
  });

  it("ends the day at the true end of the day range on a 25 hour day", () => {
    const fall: DropContext = { ...ctx, date: "2026-11-01" as LocalDate, axis: { start: 0, end: 1440 } };
    const p = placeAt(fall, makeItem(), null, 1439);
    if (p.schedule.kind !== "timed") throw new Error("expected timed");
    expect(p.schedule.end).toEqual(dayRangeFor(fall.date, zone).to);
  });
});

describe("resizeTo", () => {
  it("snaps the new end to the grid", () => {
    expect(minutes(resizeTo(ctx, timed(600, 660), 707))).toEqual([600, 705]);
  });

  it("keeps at least fifteen minutes", () => {
    expect(minutes(resizeTo(ctx, timed(600, 660), 560))).toEqual([600, 615]);
  });

  it("stops at the axis end", () => {
    expect(minutes(resizeTo(ctx, timed(600, 660), 1300))).toEqual([600, 1200]);
  });

  it("stops at midnight even on a full-day axis", () => {
    const wide: DropContext = { ...ctx, axis: { start: 0, end: 1440 } };
    expect(minutes(resizeTo(wide, timed(1380, 1420, {}, wide), 1500), wide)).toEqual([1380, 1440]);
  });

  it("does nothing for an item without a time", () => {
    expect(resizeTo(ctx, makeItem(), 700)).toBeNull();
  });
});

describe("unschedule and anyTime", () => {
  it("clear the time but leave the area alone", () => {
    expect(unschedule()).toEqual({ schedule: { kind: "unscheduled" } });
    expect(anyTime(ctx)).toEqual({ schedule: { kind: "day", on: date } });
  });
});

describe("changes", () => {
  it("is false for a drop back where the item already was", () => {
    const item = timed(600, 660);
    expect(changes(item, placeAt(ctx, item, null, 602))).toBe(false);
    expect(changes(item, placeAt(ctx, item, area("Work").id, 600))).toBe(true);
    expect(changes(makeItem(), unschedule())).toBe(false);
    expect(changes(makeItem(), anyTime(ctx))).toBe(true);
  });
});

describe("keyPlacement", () => {
  const work = "a0000000-0000-4000-8000-000000000001" as AreaId;
  const home = "a0000000-0000-4000-8000-000000000002" as AreaId;
  const order = [work, home, null];
  const press = (item: Item, key: string, shiftKey = false, c = ctx) => keyPlacement(c, item, order, { key, shiftKey });

  it("moves a beam a quarter hour with the arrows, snapping an off-grid start first", () => {
    expect(minutes(press(timed(600, 660), "ArrowRight"))).toEqual([615, 675]);
    expect(minutes(press(timed(607, 667), "ArrowLeft"))).toEqual([585, 645]);
  });

  it("changes the length with Shift and the arrows", () => {
    expect(minutes(press(timed(600, 660), "ArrowRight", true))).toEqual([600, 675]);
    expect(minutes(press(timed(600, 660), "ArrowLeft", true))).toEqual([600, 645]);
  });

  it("returns nothing at an edge where the key would change nothing", () => {
    expect(press(timed(420, 450), "ArrowLeft")).toBeNull();
    expect(press(timed(600, 615), "ArrowLeft", true)).toBeNull();
    expect(press(timed(600, 660, { areaId: work }), "ArrowUp")).toBeNull();
    expect(press(timed(600, 660), "ArrowDown")).toBeNull();
  });

  it("moves a beam between areas in order, ending on No area", () => {
    expect(press(timed(600, 660, { areaId: work }), "ArrowDown")?.areaId).toBe(home);
    expect(press(timed(600, 660, { areaId: home }), "ArrowDown")?.areaId).toBeNull();
    expect(press(timed(600, 660), "ArrowUp")?.areaId).toBe(home);
  });

  it("treats a beam in an unknown area as being on No area", () => {
    const orphan = timed(600, 660, { areaId: "a0000000-0000-4000-8000-0000000000ff" as AreaId });
    expect(press(orphan, "ArrowUp")?.areaId).toBe(home);
  });

  it("keeps the time when changing area", () => {
    const item = timed(600, 660, { areaId: work });
    expect(press(item, "ArrowDown")?.schedule).toEqual(item.schedule);
  });

  it("sends a beam back to waiting with Backspace or Delete", () => {
    expect(press(timed(600, 660), "Backspace")).toEqual(unschedule());
    expect(press(timed(600, 660), "Delete")).toEqual(unschedule());
  });

  it("gives a waiting item a time on its own area: 09:00 on another day, the next quarter hour today", () => {
    const p = press(makeItem({ areaId: home }), "ArrowUp");
    expect(minutes(p)).toEqual([540, 570]);
    expect(p?.areaId).toBe(home);
    expect(minutes(press(makeItem(), "ArrowDown", false, { ...ctx, now: 10 * 60 + 41 }))).toEqual([645, 675]);
  });

  it("keeps a waiting item placed from the keyboard inside the axis late at night", () => {
    expect(minutes(press(makeItem(), "ArrowUp", false, { ...ctx, now: 1199 }))).toEqual([1170, 1200]);
  });

  it("ignores keys it does not own", () => {
    expect(press(timed(600, 660), "Enter")).toBeNull();
    expect(press(makeItem(), "ArrowLeft")).toBeNull();
  });
});
