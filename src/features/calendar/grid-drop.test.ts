import { describe, expect, it } from "vitest";
import type { Item, LocalDate, Schedule } from "@/domain/item";
import { placeItem } from "@/features/score/commands";
import { dayOf, parseCapture } from "@/features/today/capture-syntax";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { instantAt, localMinutes, toLocalDate } from "@/lib/dates";
import { keyPlacement, lengthOf, minutesAt, moveTo, resizeTo, slotCapture, slotFor, slotWords, toAnyTime, type KeyContext } from "./grid-drop";
import { GRID_PX, gridHeight, HOUR_PX, scaleOf } from "./grid-layout";

const d = (s: string) => s as LocalDate;
const TZ = "Europe/London";
const MON = d("2026-11-09");
const TUE = d("2026-11-10");
const WED = d("2026-11-11");
const DAYS = [MON, TUE, WED];

const timed = (day: LocalDate, from: number, to: number): Item =>
  makeItem({ schedule: { kind: "timed", start: instantAt(day, from, TZ), end: instantAt(day, to, TZ) } });

/** A timed schedule as its day and wall-clock minutes. */
function wall(s: Schedule) {
  if (s.kind !== "timed") throw new Error("not timed");
  const day = toLocalDate(s.start, TZ);
  return { day, start: localMinutes(s.start, day, TZ), end: localMinutes(s.end, day, TZ) };
}

describe("pointer to time", () => {
  it("reads minutes off the column and holds them inside the day", () => {
    expect(minutesAt(HOUR_PX * 9.5)).toBe(570);
    expect(minutesAt(-40)).toBe(0);
    expect(minutesAt(GRID_PX + 80)).toBe(1440);
  });
});

describe("moveTo", () => {
  it("snaps to the quarter hour and keeps the length", () => {
    expect(wall(moveTo(timed(MON, 540, 630), MON, 607, TZ).schedule)).toEqual({ day: MON, start: 600, end: 690 });
    expect(wall(moveTo(timed(MON, 540, 630), MON, 608, TZ).schedule)).toEqual({ day: MON, start: 615, end: 705 });
  });

  it("moves across day columns", () => {
    expect(wall(moveTo(timed(MON, 540, 600), WED, 840, TZ).schedule)).toEqual({ day: WED, start: 840, end: 900 });
  });

  it("holds the start inside the day, letting the end run past midnight", () => {
    expect(wall(moveTo(timed(MON, 540, 600), MON, -30, TZ).schedule)).toEqual({ day: MON, start: 0, end: 60 });
    expect(wall(moveTo(timed(MON, 540, 600), MON, 1439, TZ).schedule)).toEqual({ day: MON, start: 1425, end: 1485 });
  });

  it("carries an item that crosses midnight back a day when its later part is dragged", () => {
    // 23:00 to 01:00, held by the part after midnight and dropped on Wednesday's column two hours before midnight's line.
    const night = timed(MON, 1380, 1500);
    expect(wall(moveTo(night, WED, -120, TZ).schedule)).toEqual({ day: TUE, start: 1320, end: 1440 });
  });

  it("gives an item with no time the default length, or the one asked for", () => {
    const chip = makeItem({ schedule: { kind: "day", on: MON } });
    expect(wall(moveTo(chip, TUE, 600, TZ).schedule)).toEqual({ day: TUE, start: 600, end: 630 });
    expect(wall(moveTo(chip, TUE, 600, TZ, 45).schedule)).toEqual({ day: TUE, start: 600, end: 645 });
  });

  it("keeps the wall-clock length onto a day the clocks change", () => {
    const spring = d("2026-03-29");
    const moved = moveTo(timed(d("2026-03-27"), 540, 630), spring, 540, TZ);
    expect(wall(moved.schedule)).toEqual({ day: spring, start: 540, end: 630 });
    // 00:30 to 02:30 on the short day is an hour of real time, yet reads 00:30 to 02:30.
    const across = moveTo(timed(d("2026-03-27"), 30, 150), spring, 30, TZ).schedule;
    expect(wall(across)).toEqual({ day: spring, start: 30, end: 150 });
    expect(across.kind === "timed" && across.end.getTime() - across.start.getTime()).toBe(3_600_000);
  });

  it("reads an item's length off the wall clock", () => {
    expect(lengthOf(timed(d("2026-03-29"), 30, 150), TZ)).toBe(120);
    expect(lengthOf(makeItem(), TZ)).toBe(30);
  });
});

describe("resizeTo", () => {
  it("moves the end, snapped, keeping the start", () => {
    expect(wall(resizeTo(timed(MON, 540, 600), MON, 652, TZ)!.schedule)).toEqual({ day: MON, start: 540, end: 645 });
  });

  it("keeps a quarter hour at least", () => {
    expect(wall(resizeTo(timed(MON, 540, 600), MON, 300, TZ)!.schedule)).toEqual({ day: MON, start: 540, end: 555 });
  });

  it("stops at midnight", () => {
    expect(wall(resizeTo(timed(MON, 1320, 1380), MON, 1600, TZ)!.schedule)).toEqual({ day: MON, start: 1320, end: 1440 });
  });

  it("resizes the part after midnight of an item that crosses it", () => {
    expect(wall(resizeTo(timed(MON, 1380, 1500), TUE, 90, TZ)!.schedule)).toEqual({ day: MON, start: 1380, end: 1530 });
  });

  it("is null for an item with no time", () => {
    expect(resizeTo(makeItem(), MON, 600, TZ)).toBeNull();
  });
});

describe("slotFor", () => {
  it("takes the quarter hour under a click and the default length", () => {
    expect(slotFor(MON, 607, 607)).toEqual({ day: MON, start: 600, length: 30 });
    expect(slotFor(MON, 607, 607, 60)).toEqual({ day: MON, start: 600, length: 60 });
  });

  it("runs from the quarter hour a drag began in to the one it ended in, either way up", () => {
    expect(slotFor(MON, 607, 700)).toEqual({ day: MON, start: 600, length: 105 });
    expect(slotFor(MON, 700, 607)).toEqual({ day: MON, start: 600, length: 105 });
  });

  it("stays inside the day", () => {
    expect(slotFor(MON, 1435, 1435)).toEqual({ day: MON, start: 1425, length: 15 });
    expect(slotFor(MON, 1300, 1440)).toEqual({ day: MON, start: 1290, length: 150 });
  });
});

describe("slotCapture", () => {
  const slot = { day: MON, start: 15 * 60, length: 30 };
  const saved = (typed: string, today = MON) => {
    const said = parseCapture(slotCapture(typed, slot, today, "24").text);
    return { title: said.title, day: said.day && dayOf(said.day, today), time: said.time, soon: said.soon };
  };

  it("applies the slot to a bare title", () => {
    expect(saved("Dentist")).toEqual({ title: "Dentist", day: MON, time: { start: 900, length: 30 }, soon: undefined });
    expect(slotCapture("", slot, MON, "24").text).toBe("today 15:00 for 30m");
  });

  it("lets a typed day win and keeps the slot's time", () => {
    expect(saved("Dentist tomorrow")).toEqual({ title: "Dentist", day: TUE, time: { start: 900, length: 30 }, soon: undefined });
  });

  it("lets a typed time win and keeps the slot's day", () => {
    expect(saved("Dentist 9am")).toEqual({ title: "Dentist", day: MON, time: { start: 540, length: null }, soon: undefined });
  });

  it("lets a typed day and time win together", () => {
    expect(saved("Dentist tomorrow 9am")).toEqual({ title: "Dentist", day: TUE, time: { start: 540, length: null }, soon: undefined });
  });

  it("lets a typed length set the slot's length", () => {
    for (const typed of ["Dentist 1h", "Dentist for 1h"]) {
      expect(saved(typed)).toEqual({ title: "Dentist", day: MON, time: { start: 900, length: 60 }, soon: undefined });
    }
    expect(saved("Dentist 1h 30m").time).toEqual({ start: 900, length: 90 });
  });

  it("leaves an 'in 2 hours' alone", () => {
    expect(saved("Dentist in 2 hours")).toMatchObject({ title: "Dentist", day: null, time: null, soon: { after: 120 } });
  });

  it("says what the words took over", () => {
    expect(slotCapture("Dentist", slot, MON, "24")).toMatchObject({ day: false, time: false });
    expect(slotCapture("Dentist tomorrow", slot, MON, "24")).toMatchObject({ day: true, time: false });
    expect(slotCapture("Dentist 1h", slot, MON, "24")).toMatchObject({ day: false, time: true });
  });
});

describe("slotWords", () => {
  const read = (slot: { day: LocalDate; start: number; length: number }, clock: "12" | "24") => {
    const said = parseCapture(`Call Sam${slotWords(slot, MON, clock)}`);
    return { title: said.title, day: said.day && dayOf(said.day, MON), time: said.time };
  };

  it.each(["12", "24"] as const)("is read back by capture on the %s-hour clock", (clock) => {
    for (const slot of [
      { day: MON, start: 14 * 60, length: 30 },
      { day: TUE, start: 9 * 60 + 15, length: 105 },
      { day: d("2026-11-14"), start: 0, length: 60 },
      { day: d("2026-11-08"), start: 12 * 60, length: 15 },
      { day: MON, start: 23 * 60 + 45, length: 15 },
    ]) {
      expect(read(slot, clock)).toEqual({ title: "Call Sam", day: slot.day, time: { start: slot.start, length: slot.length } });
    }
  });

  it("says today and tomorrow in words", () => {
    expect(slotWords({ day: MON, start: 840, length: 30 }, MON, "24")).toBe(" today 14:00 for 30m");
    expect(slotWords({ day: TUE, start: 840, length: 90 }, MON, "12")).toBe(" tomorrow 2:00pm for 1h 30m");
    expect(slotWords({ day: WED, start: 840, length: 60 }, MON, "24")).toBe(" 2026-11-11 14:00 for 1h");
  });
});

describe("any time and back", () => {
  it("plans a block for the day with no time", () => {
    expect(toAnyTime(TUE)).toEqual({ schedule: { kind: "day", on: TUE } });
  });

  it("saves through the Score's place command", async () => {
    const item = makeItem({ schedule: { kind: "day", on: MON } });
    const { repo, items } = fakeRepo([item]);
    expect(await placeItem(repo, item.id, moveTo(item, TUE, 615, TZ), TZ)).toEqual({ ok: true });
    expect(wall(items[0].schedule)).toEqual({ day: TUE, start: 615, end: 645 });
    expect(await placeItem(repo, item.id, toAnyTime(WED), TZ)).toEqual({ ok: true });
    expect(items[0].schedule).toEqual({ kind: "day", on: WED });
    const night = moveTo(timed(MON, 1380, 1500), MON, 1425, TZ);
    expect(await placeItem(repo, item.id, night, TZ)).toEqual({ ok: true });
  });
});

describe("keyPlacement", () => {
  const ctx: KeyContext = { days: DAYS, timeZone: TZ, now: null, today: d("2026-11-20") };
  const press = (key: string, mod: "alt" | "shift" | "" = "alt") => ({ key, altKey: mod === "alt", shiftKey: mod === "shift" });

  it("moves a block a quarter hour with Alt Up and Down", () => {
    const item = timed(TUE, 540, 600);
    expect(wall(keyPlacement(ctx, item, press("ArrowDown"))!.schedule)).toEqual({ day: TUE, start: 555, end: 615 });
    expect(wall(keyPlacement(ctx, item, press("ArrowUp"))!.schedule)).toEqual({ day: TUE, start: 525, end: 585 });
  });

  it("moves a block a day with Alt Left and Right, inside the days shown", () => {
    const item = timed(TUE, 540, 600);
    expect(wall(keyPlacement(ctx, item, press("ArrowRight"))!.schedule)).toEqual({ day: WED, start: 540, end: 600 });
    expect(wall(keyPlacement(ctx, item, press("ArrowLeft"))!.schedule)).toEqual({ day: MON, start: 540, end: 600 });
    expect(keyPlacement(ctx, timed(WED, 540, 600), press("ArrowRight"))).toBeNull();
  });

  it("changes the length with Shift Up and Down", () => {
    const item = timed(TUE, 540, 600);
    expect(wall(keyPlacement(ctx, item, press("ArrowDown", "shift"))!.schedule)).toEqual({ day: TUE, start: 540, end: 615 });
    expect(keyPlacement(ctx, timed(TUE, 540, 555), press("ArrowUp", "shift"))).toBeNull();
  });

  it("gives an any-time item a time with Alt Down: 09:00, or the next quarter hour today", () => {
    const chip = makeItem({ schedule: { kind: "day", on: TUE } });
    expect(wall(keyPlacement(ctx, chip, press("ArrowDown"))!.schedule)).toEqual({ day: TUE, start: 540, end: 570 });
    const today = { ...ctx, today: TUE, now: 13 * 60 + 20 };
    expect(wall(keyPlacement(today, chip, press("ArrowDown"))!.schedule)).toEqual({ day: TUE, start: 810, end: 840 });
    expect(keyPlacement(ctx, chip, press("ArrowUp"))).toBeNull();
  });

  it("moves an any-time item a day sideways", () => {
    const chip = makeItem({ schedule: { kind: "day", on: TUE } });
    expect(keyPlacement(ctx, chip, press("ArrowRight"))).toEqual({ schedule: { kind: "day", on: WED } });
  });

  it("takes a block's time away with Alt Home, or Alt Up at midnight", () => {
    expect(keyPlacement(ctx, timed(TUE, 540, 600), press("Home"))).toEqual({ schedule: { kind: "day", on: TUE } });
    expect(keyPlacement(ctx, timed(TUE, 0, 60), press("ArrowUp"))).toEqual({ schedule: { kind: "day", on: TUE } });
  });

  it("leaves plain arrows and unplanned items alone", () => {
    expect(keyPlacement(ctx, timed(TUE, 540, 600), press("ArrowDown", ""))).toBeNull();
    expect(keyPlacement(ctx, makeItem(), press("ArrowDown"))).toBeNull();
  });
});

describe("pointer to time in a visible range", () => {
  const scale = scaleOf(7 * 60, 22 * 60, 48);
  it("counts from the range's first hour, not midnight", () => {
    expect(minutesAt(0, scale)).toBe(7 * 60);
    expect(minutesAt(96, scale)).toBe(9 * 60);
    expect(minutesAt(gridHeight(scale) + 4000, scale)).toBe(1440);
  });

  it("places a slot and a move from where the range starts", () => {
    const item = timed(MON, 9 * 60, 10 * 60);
    const slot = slotFor(MON, minutesAt(24, scale), minutesAt(24, scale));
    expect(slot.start).toBe(7 * 60 + 30);
    const p = moveTo(item, TUE, minutesAt(144, scale), TZ);
    expect(wall(p.schedule)).toEqual({ day: TUE, start: 10 * 60, end: 11 * 60 });
  });
});
