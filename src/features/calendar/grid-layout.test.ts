import { describe, expect, it } from "vitest";
import type { Item, LocalDate } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { instantAt } from "@/lib/dates";
import {
  blockBox,
  fitHourPx,
  GRID_PX,
  gridHeight,
  HOUR_PX,
  layoutGrid,
  MAX_HOUR_PX,
  MIN_BLOCK_PX,
  MIN_HOUR_PX,
  minutesAtY,
  nowLine,
  openMinute,
  packDay,
  rangeSpans,
  scaleOf,
  segmentOn,
  visibleRange,
  emptyDayRange,
  yAt,
} from "./grid-layout";

const d = (s: string) => s as LocalDate;
const TZ = "Europe/London";
const MON = d("2026-11-09");
const WEEK = Array.from({ length: 7 }, (_, i) => d(`2026-11-${String(9 + i).padStart(2, "0")}`));

let n = 0;
function timed(title: string, day: LocalDate, from: number, to: number, over: Partial<Item> = {}): Item {
  return makeItem({
    id: `a0000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as Item["id"],
    title,
    schedule: { kind: "timed", start: instantAt(day, from, TZ), end: instantAt(day, to, TZ) },
    ...over,
  });
}
const seg = (title: string, start: number, end: number) => ({ item: timed(title, MON, start, end), start, end, before: false, after: false });
const byTitle = <T extends { item: { title: string } }>(blocks: T[]) => Object.fromEntries(blocks.map((b) => [b.item.title, b]));

describe("minutes to y", () => {
  it("draws an hour as HOUR_PX and the day as 24 of them", () => {
    expect(yAt(60)).toBe(HOUR_PX);
    expect(yAt(1440)).toBe(GRID_PX);
  });
});

describe("packDay", () => {
  it("gives an item alone the whole column", () => {
    const [b] = packDay([seg("a", 540, 600)]);
    expect(b).toMatchObject({ column: 0, columns: 1, span: 1, top: yAt(540), height: yAt(60) });
    expect(blockBox(b)).toEqual({ left: 0, width: 1 });
  });

  it("puts two overlapping items side by side", () => {
    const b = byTitle(packDay([seg("a", 540, 600), seg("b", 570, 630)]));
    expect(b.a).toMatchObject({ column: 0, columns: 2 });
    expect(b.b).toMatchObject({ column: 1, columns: 2 });
    expect(blockBox(b.b)).toEqual({ left: 0.5, width: 0.5 });
  });

  it("reuses a column once it is free, and keeps separate groups at full width", () => {
    const b = byTitle(packDay([seg("a", 540, 600), seg("b", 570, 660), seg("c", 600, 660), seg("later", 720, 780)]));
    expect(b.a.column).toBe(0);
    expect(b.b.column).toBe(1);
    expect(b.c).toMatchObject({ column: 0, columns: 2 });
    expect(b.later).toMatchObject({ column: 0, columns: 1 });
  });

  it("widens an item over free columns to its right", () => {
    // a, b and c overlap at 9:30 in three columns; d overlaps only a, so it takes columns 1 and 2.
    const b = byTitle(packDay([seg("a", 540, 720), seg("b", 540, 600), seg("c", 570, 600), seg("d", 630, 690)]));
    expect(b.c).toMatchObject({ column: 2, columns: 3, span: 1 });
    expect(b.d).toMatchObject({ column: 1, columns: 3, span: 2 });
    expect(blockBox(b.d).width).toBeCloseTo(2 / 3);
  });

  it("draws a short item at the least height without making it share width with a later item", () => {
    const b = byTitle(packDay([seg("five", 540, 545), seg("next", 550, 610)]));
    expect(b.five.height).toBe(MIN_BLOCK_PX);
    expect(b.five.columns).toBe(1);
    expect(b.next.column).toBe(0);
    expect(b.next.columns).toBe(1);
  });

  it("keeps items that touch end to start at full width", () => {
    const b = byTitle(packDay([seg("standup", 570, 585), seg("brief", 600, 660), seg("flush", 660, 720)]));
    for (const t of ["standup", "brief", "flush"]) expect([b[t].column, b[t].columns]).toEqual([0, 1]);
    // The tiny block ends where the next starts in real time, and is still drawn at its least height.
    expect(b.standup.height).toBe(MIN_BLOCK_PX);
    const b2 = byTitle(packDay([seg("a", 540, 600), seg("b", 600, 660)]));
    expect([b2.a.columns, b2.b.columns]).toEqual([1, 1]);
  });

  it("puts truly overlapping items side by side, tiny ones included", () => {
    const b = byTitle(packDay([seg("long", 540, 600), seg("tiny", 570, 575), seg("after", 600, 630)]));
    expect(b.long.columns).toBe(2);
    expect(b.tiny.column).toBe(1);
    expect(b.after.columns).toBe(1);
    const z = byTitle(packDay([seg("x", 600, 600), seg("y", 600, 630)]));
    expect([z.y.column, z.x.column]).toEqual([0, 1]);
  });

  it("draws an item with no length", () => {
    const [b] = packDay([seg("ping", 600, 600)]);
    expect(b.height).toBe(MIN_BLOCK_PX);
  });

  it("orders ties the same way every time", () => {
    const a = packDay([seg("b", 540, 600), seg("a", 540, 600)]).map((x) => [x.item.title, x.column]);
    expect(a).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});

describe("segmentOn", () => {
  it("splits an item that crosses midnight between its two days", () => {
    const late = timed("Night shift", MON, 22 * 60, 26 * 60);
    expect(segmentOn(late, MON, TZ)).toEqual({ start: 1320, end: 1440, before: false, after: true });
    expect(segmentOn(late, WEEK[1], TZ)).toEqual({ start: 0, end: 120, before: true, after: false });
    expect(segmentOn(late, WEEK[2], TZ)).toBeNull();
  });

  it("keeps an item that ends at midnight off the next day", () => {
    const item = timed("Late", MON, 23 * 60, 24 * 60);
    expect(segmentOn(item, MON, TZ)).toMatchObject({ end: 1440, after: false });
    expect(segmentOn(item, WEEK[1], TZ)).toBeNull();
  });

  it("reads wall-clock minutes on the day the clocks go forward", () => {
    // 29 March 2026 in London has no 01:00 to 02:00; 09:00 is still drawn at 09:00.
    const spring = d("2026-03-29");
    expect(segmentOn(timed("Breakfast", spring, 540, 600), spring, TZ)).toMatchObject({ start: 540, end: 600 });
    // An item across the gap ends where its clock says, an hour of real time shorter.
    const across = timed("Across", spring, 30, 180);
    expect(segmentOn(across, spring, TZ)).toMatchObject({ start: 30, end: 180 });
    expect(across.schedule.kind === "timed" && across.schedule.end.getTime() - across.schedule.start.getTime()).toBe(90 * 60_000);
  });

  it("reads wall-clock minutes on the day the clocks go back", () => {
    const autumn = d("2026-10-25");
    expect(segmentOn(timed("Lunch", autumn, 720, 780), autumn, TZ)).toMatchObject({ start: 720, end: 780 });
    expect(segmentOn(timed("Late", autumn, 23 * 60, 24 * 60), autumn, TZ)).toMatchObject({ start: 1380, end: 1440, after: false });
  });

  it("is null for anything without a time", () => {
    expect(segmentOn(makeItem({ schedule: { kind: "day", on: MON } }), MON, TZ)).toBeNull();
  });
});

describe("layoutGrid", () => {
  const now = instantAt(WEEK[2], 13 * 60 + 20, TZ);

  it("sorts items into their day columns and the any-time row", () => {
    const items = [
      timed("Stand-up", MON, 570, 585),
      timed("Run", WEEK[2], 420, 465),
      makeItem({ title: "Pay bill", schedule: { kind: "day", on: WEEK[2] }, position: 2 }),
      makeItem({ title: "Post parcel", schedule: { kind: "day", on: WEEK[2] }, position: 1 }),
      makeItem({ title: "Someday" }),
      timed("Next week", d("2026-11-16"), 540, 600),
      timed("A note", MON, 540, 600, { type: "note" }),
      timed("Skipped", MON, 540, 600, { status: "dropped" }),
    ];
    const { columns } = layoutGrid({ days: WEEK, items, timeZone: TZ, now });
    expect(columns.map((c) => c.date)).toEqual(WEEK);
    expect(columns[0].blocks.map((b) => b.item.title)).toEqual(["Stand-up"]);
    expect(columns[2].blocks.map((b) => b.item.title)).toEqual(["Run"]);
    expect(columns[2].anyTime.map((i) => i.title)).toEqual(["Post parcel", "Pay bill"]);
    expect(columns.flatMap((c) => c.blocks).length).toBe(2);
  });

  it("lays out one day and three days the same way", () => {
    const items = [timed("Run", WEEK[2], 420, 465)];
    expect(layoutGrid({ days: [WEEK[2]], items, timeZone: TZ, now }).columns[0].blocks).toHaveLength(1);
    const three = layoutGrid({ days: WEEK.slice(1, 4), items, timeZone: TZ, now });
    expect(three.columns.map((c) => c.blocks.length)).toEqual([0, 1, 0]);
    expect(three.now).toMatchObject({ day: 1 });
  });

  it("draws both parts of an item that crosses midnight", () => {
    const { columns } = layoutGrid({ days: WEEK, items: [timed("Night", WEEK[5], 1380, 1500)], timeZone: TZ, now });
    expect(columns[5].blocks[0]).toMatchObject({ start: 1380, end: 1440, after: true });
    expect(columns[6].blocks[0]).toMatchObject({ start: 0, end: 60, before: true, top: 0 });
  });
});

describe("the now line", () => {
  it("sits on today's column at the wall-clock time", () => {
    expect(nowLine(WEEK, instantAt(WEEK[3], 615, TZ), TZ)).toEqual({ day: 3, minutes: 615, top: yAt(615) });
  });

  it("is absent when today is not shown", () => {
    expect(nowLine(WEEK, instantAt(d("2026-11-20"), 615, TZ), TZ)).toBeNull();
  });

  it("reads the clock, not elapsed time, after the clocks change", () => {
    const spring = d("2026-03-29");
    expect(nowLine([spring], instantAt(spring, 900, TZ), TZ)?.minutes).toBe(900);
  });

  it("opens the grid a little before now, or at 07:00 on other days", () => {
    expect(openMinute({ day: 0, minutes: 13 * 60 + 20, top: 0 })).toBe(11 * 60);
    expect(openMinute({ day: 0, minutes: 40, top: 0 })).toBe(0);
    expect(openMinute(null)).toBe(7 * 60);
  });
});

describe("visibleRange", () => {
  it("is 07:00 to 22:00 when nothing is planned outside it", () => {
    expect(visibleRange([], null)).toEqual({ from: 7 * 60, to: 22 * 60 });
    expect(visibleRange([{ start: 9 * 60, end: 10 * 60 }], null)).toEqual({ from: 7 * 60, to: 22 * 60 });
  });

  it("reaches an hour before the earliest and an hour after the latest, on whole hours", () => {
    expect(visibleRange([{ start: 5 * 60 + 30, end: 6 * 60 }, { start: 21 * 60, end: 22 * 60 + 15 }], null)).toEqual({ from: 4 * 60, to: 24 * 60 });
    expect(visibleRange([{ start: 6 * 60 + 20, end: 8 * 60 }], null).from).toBe(5 * 60);
  });

  it("holds an item that runs to midnight, and one that began the day before", () => {
    expect(visibleRange([{ start: 0, end: 90 }], null)).toEqual({ from: 0, to: 22 * 60 });
    expect(visibleRange([{ start: 23 * 60, end: 1440 }], null).to).toBe(1440);
  });

  it("counts now as planned, so the line is never off the page", () => {
    expect(visibleRange([], 23 * 60).to).toBe(1440);
    expect(visibleRange([], 3 * 60)).toEqual({ from: 2 * 60, to: 22 * 60 });
  });

  it("opens out to midnight at either end on request", () => {
    expect(visibleRange([], null, { earlier: true })).toEqual({ from: 0, to: 22 * 60 });
    expect(visibleRange([], null, { later: true })).toEqual({ from: 7 * 60, to: 1440 });
  });
});

describe("rangeSpans", () => {
  it("reads the days shown only", () => {
    const items = [timed("Mon", MON, 6 * 60, 7 * 60), timed("Wed", WEEK[2], 23 * 60, 1440)];
    expect(rangeSpans([MON], items, TZ).map((s) => [s.start, s.end])).toEqual([[360, 420]]);
    expect(rangeSpans(WEEK, items, TZ)).toHaveLength(2);
  });
});

describe("fitHourPx", () => {
  it("gives the range the height it has, within bounds", () => {
    expect(fitHourPx(15, 750)).toBe(50);
    expect(fitHourPx(15, 5000)).toBe(MAX_HOUR_PX);
  });

  it("never draws an hour under the minimum: the grid scrolls instead", () => {
    expect(fitHourPx(24, 600)).toBe(MIN_HOUR_PX);
  });

  it("uses the usual hour before the window is measured", () => {
    expect(fitHourPx(15, null)).toBe(HOUR_PX);
  });
});

describe("a visible range scale", () => {
  const scale = scaleOf(7 * 60, 22 * 60, 48);
  it("puts the range's first minute at the top", () => {
    expect(yAt(7 * 60, scale)).toBe(0);
    expect(yAt(9 * 60, scale)).toBe(96);
    expect(gridHeight(scale)).toBe(15 * 48);
    expect(minutesAtY(96, scale)).toBe(9 * 60);
  });

  it("positions blocks and the now line from the range's top", () => {
    const [b] = packDay([seg("a", 9 * 60, 10 * 60)], scale);
    expect(b).toMatchObject({ top: 96, height: 48 });
    expect(nowLine(WEEK, instantAt(WEEK[0], 8 * 60, TZ), TZ, scale)?.top).toBe(48);
  });

  it("opens on the top of the range for another day, and not above it for today", () => {
    expect(openMinute(null, 5 * 60)).toBe(5 * 60);
    expect(openMinute({ day: 0, minutes: 8 * 60, top: 0 }, 7 * 60)).toBe(7 * 60);
  });
});

describe("emptyDayRange", () => {
  it("draws nine hours from two before now, kept inside the day", () => {
    expect(emptyDayRange(12 * 60 + 34)).toEqual({ from: 10 * 60, to: 19 * 60 });
    expect(emptyDayRange(60)).toEqual({ from: 0, to: 9 * 60 });
    expect(emptyDayRange(23 * 60)).toEqual({ from: 15 * 60, to: 24 * 60 });
  });

  it("is 08:00 to 17:00 when now is not on screen, and opens out on request", () => {
    expect(emptyDayRange(null)).toEqual({ from: 8 * 60, to: 17 * 60 });
    expect(emptyDayRange(null, { earlier: true, later: true })).toEqual({ from: 0, to: 1440 });
  });
});
