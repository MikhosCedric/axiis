import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { buildToday } from "@/features/today/model";
import { area, makeItem } from "@/features/today/test-support";
import { dayRangeFor, instantAt } from "@/lib/dates";
import {
  axisFor,
  beamTop,
  DEFAULT_AXIS,
  hourTicks,
  labelWidth,
  layoutScore,
  minutesAt,
  NO_AREA,
  packRows,
  PX_PER_MINUTE,
  spanOf,
  staffAt,
  staffHeight,
  xAt,
} from "./layout";

const date = "2026-10-06" as LocalDate;
const zone = "Europe/London";
const at = (h: number, m = 0) => instantAt(date, h * 60 + m, zone);
const timed = (title: string, start: Date, end: Date, over = {}) =>
  makeItem({ title, schedule: { kind: "timed", start, end }, ...over });
const span = (start: number, end: number) => ({ start, end });

describe("spanOf", () => {
  it("reads a timed item as local wall-clock minutes", () => {
    expect(spanOf(timed("a", at(9, 30), at(10, 15)), date, zone)).toEqual(span(570, 615));
  });

  it("clips an item that runs past midnight to the end of the day", () => {
    const late = timed("a", at(23), instantAt("2026-10-07" as LocalDate, 60, zone));
    expect(spanOf(late, date, zone)).toEqual(span(23 * 60, 1440));
  });

  it("has no span for day-only or unscheduled items", () => {
    expect(spanOf(makeItem({ schedule: { kind: "day", on: date } }), date, zone)).toBeNull();
    expect(spanOf(makeItem(), date, zone)).toBeNull();
  });

  it("uses the wall clock on a fall-back day, so 09:00 is 540 though 25 hours fit the day", () => {
    const d = "2026-10-25" as LocalDate;
    const item = timed("a", instantAt(d, 540, zone), instantAt(d, 600, zone));
    expect(spanOf(item, d, zone)).toEqual(span(540, 600));
  });
});

describe("axisFor", () => {
  it("is 07:00 to 20:00 when everything fits", () => {
    expect(axisFor([span(480, 600)], 630)).toEqual(DEFAULT_AXIS);
  });

  it("widens to whole hours around an early start and a late end", () => {
    expect(axisFor([span(6 * 60 + 30, 7 * 60 + 15), span(21 * 60, 21 * 60 + 45)], null)).toEqual(span(360, 22 * 60));
  });

  it("includes now on today, even late in the evening", () => {
    expect(axisFor([], 22 * 60 + 10)).toEqual(span(420, 23 * 60));
    expect(axisFor([], 20 * 60)).toEqual(span(420, 21 * 60));
  });

  it("never runs past midnight on either side", () => {
    expect(axisFor([span(0, 30), span(23 * 60 + 45, 1440)], null)).toEqual(span(0, 1440));
  });
});

describe("x and minutes", () => {
  const axis = span(420, 1200);
  it("are inverse, with the axis start at x = 0", () => {
    expect(xAt(axis, 420)).toBe(0);
    expect(xAt(axis, 480)).toBe(76);
    expect(minutesAt(axis, 76)).toBe(480);
    expect(minutesAt(axis, xAt(axis, 777))).toBeCloseTo(777);
  });

  it("puts a tick on every hour of the axis", () => {
    expect(hourTicks(span(420, 600))).toEqual([420, 480, 540]);
  });
});

describe("packRows", () => {
  const pack = (spans: [string, number, number][]) =>
    packRows(
      spans.map(([value, s, e]) => ({ value, span: span(s, e) })),
      1200,
    );

  it("keeps items that only touch on one sub-row", () => {
    const { rows, placed } = pack([
      ["a", 600, 660],
      ["b", 660, 720],
    ]);
    expect(rows).toBe(1);
    expect(placed.map((p) => p.row)).toEqual([0, 0]);
  });

  it("stacks overlapping items and reuses the first sub-row that is free", () => {
    const { rows, placed } = pack([
      ["c", 720, 780],
      ["a", 600, 720],
      ["b", 630, 690],
      ["d", 700, 760],
      ["e", 640, 700],
    ]);
    expect(rows).toBe(3);
    expect(Object.fromEntries(placed.map((p) => [p.value, p.row]))).toEqual({ a: 0, b: 1, e: 2, d: 1, c: 0 });
  });

  it("gives each label the minutes up to the next start in its own sub-row, or to the axis end", () => {
    const { placed } = pack([
      ["a", 600, 615],
      ["b", 610, 700],
      ["c", 630, 660],
    ]);
    const free = Object.fromEntries(placed.map((p) => [p.value, p.free]));
    expect(free).toEqual({ a: 30, b: 1200 - 610, c: 1200 - 630 });
  });

  it("converts free minutes to a label width with a small gap, never negative", () => {
    expect(labelWidth(30)).toBe(30 * PX_PER_MINUTE - 8);
    expect(labelWidth(0)).toBe(0);
  });

  it("reports one sub-row for an empty staff", () => {
    expect(pack([]).rows).toBe(1);
  });
});

describe("layoutScore", () => {
  const work = area("Work");
  const home = area("Home");
  const range = dayRangeFor(date, zone);
  const now = at(10, 40);
  const build = (scheduled: ReturnType<typeof makeItem>[], unscheduled: ReturnType<typeof makeItem>[] = []) =>
    layoutScore({
      view: buildToday({ scheduled, unscheduled }, range, now),
      areas: [work, home],
      date,
      timeZone: zone,
      now: 640,
    });

  it("draws one staff per area in order and leaves out No area when nothing needs it", () => {
    const score = build([timed("Brief", at(10), at(11), { areaId: work.id })]);
    expect(score.staves.map((s) => s.name)).toEqual(["Work", "Home"]);
    expect(score.staves[0].beams.map((b) => b.value.item.title)).toEqual(["Brief"]);
    expect(score.areaOrder).toEqual([work.id, home.id, null]);
  });

  it("adds a final No area staff for timed items without a known area", () => {
    const score = build([timed("Dentist", at(16), at(17)), timed("Orphan", at(9), at(10), { areaId: area("Gone").id })]);
    expect(score.staves.map((s) => s.name)).toEqual(["Work", "Home", NO_AREA]);
    expect(score.staves[2].beams.map((b) => b.value.item.title)).toEqual(["Orphan", "Dentist"]);
  });

  it("shows a No area staff when there are no areas at all, so there is somewhere to drop", () => {
    const score = layoutScore({ view: { scheduled: [], waiting: [] }, areas: [], date, timeZone: zone, now: null });
    expect(score.staves.map((s) => s.name)).toEqual([NO_AREA]);
  });

  it("puts day-only items in Any time, not on a staff", () => {
    const score = build([makeItem({ title: "Bills", areaId: home.id, schedule: { kind: "day", on: date } })]);
    expect(score.anyTime.map((e) => e.item.title)).toEqual(["Bills"]);
    expect(score.staves.every((s) => s.beams.length === 0)).toBe(true);
  });

  it("stacks staves by their heights and counts open beams", () => {
    const score = build([
      timed("a", at(10), at(11), { areaId: work.id }),
      timed("b", at(10, 30), at(11, 30), { areaId: work.id, status: "done" }),
    ]);
    const [w, h] = score.staves;
    expect(w.rows).toBe(2);
    expect(w.open).toBe(1);
    expect(w.height).toBe(staffHeight(2));
    expect(h.top).toBe(w.height + 1);
  });

  it("finds the staff under a y offset, including the rule below it", () => {
    const score = build([]);
    const [w, h] = score.staves;
    expect(staffAt(score.staves, 0)).toBe(0);
    expect(staffAt(score.staves, w.height)).toBe(0);
    expect(staffAt(score.staves, h.top)).toBe(1);
    expect(staffAt(score.staves, -1)).toBe(-1);
    expect(staffAt(score.staves, h.top + h.height + 1)).toBe(-1);
  });

  it("lands a pending drop on the first sub-row with room, ignoring the item being moved", () => {
    const a = timed("a", at(10), at(11), { areaId: work.id });
    const b = timed("b", at(10, 30), at(11, 30), { areaId: work.id });
    const items = [a, b, timed("c", at(13), at(14), { areaId: work.id })];
    const lay = (pending: Parameters<typeof layoutScore>[0]["pending"]) =>
      layoutScore({ view: buildToday({ scheduled: items, unscheduled: [] }, range, now), areas: [work, home], date, timeZone: zone, now: null, pending });

    expect(lay({ itemId: area("x").id as never, areaId: work.id, span: span(780, 810) }).ghost).toEqual({ staff: 0, row: 1 });
    expect(lay({ itemId: a.id, areaId: work.id, span: span(615, 645) }).ghost).toEqual({ staff: 0, row: 0 });
    expect(lay({ itemId: b.id, areaId: home.id, span: span(615, 645) }).ghost).toEqual({ staff: 1, row: 0 });
  });

  it("grows the target staff by a row when no sub-row has room, without moving the staves above", () => {
    const items = [timed("a", at(10), at(11), { areaId: home.id })];
    const score = layoutScore({
      view: buildToday({ scheduled: items, unscheduled: [] }, range, now),
      areas: [work, home],
      date,
      timeZone: zone,
      now: null,
      pending: { itemId: area("x").id as never, areaId: home.id, span: span(630, 660) },
    });
    expect(score.ghost).toEqual({ staff: 1, row: 1 });
    expect(score.staves[1].rows).toBe(2);
    expect(score.staves[1].top).toBe(staffHeight(1) + 1);
  });

  it("sits each sub-row's beam at the bottom of its row", () => {
    expect(beamTop(0)).toBe(39);
    expect(beamTop(1)).toBe(39 + 64);
  });
});
