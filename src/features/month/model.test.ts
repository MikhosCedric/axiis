import { describe, expect, it } from "vitest";
import type { Area, AreaId, Item, LocalDate } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { dayRangeFor, instantAt } from "@/lib/dates";
import {
  addMonths,
  buildMonth,
  gridStep,
  MARKS_PER_DAY,
  monthGrid,
  monthHref,
  monthNavTarget,
  monthRange,
  monthSummary,
  namesNoMonth,
  parseYearMonth,
  sameDayIn,
  type YearMonth,
} from "./model";

const d = (s: string) => s as LocalDate;
const ym = (s: string) => s as YearMonth;
const NOW = new Date("2026-10-14T12:00:00Z");

function build(month: string, items: Item[], { due = [] as Item[], areas = [] as Area[], timeZone = "UTC" } = {}) {
  const days = monthGrid(ym(month));
  return buildMonth({ month: ym(month), days, scheduled: items, due, areas, timeZone, now: NOW });
}

const cell = (b: ReturnType<typeof build>, date: string) => b.cells.find((c) => c.date === date)!;
const timed = (date: string, from: number, to: number, timeZone = "UTC", over: Partial<Item> = {}) =>
  makeItem({ schedule: { kind: "timed", start: instantAt(d(date), from, timeZone), end: instantAt(d(date), to, timeZone) }, ...over });

describe("parseYearMonth", () => {
  it("takes a real month inside the span Axiis plans on", () => {
    expect(parseYearMonth("2026-10")).toBe("2026-10");
    expect(parseYearMonth("1970-01")).toBe("1970-01");
    expect(parseYearMonth("2200-12")).toBe("2200-12");
  });

  it("refuses anything else", () => {
    for (const raw of ["2026-13", "2026-00", "2026-1", "26-10", "1969-12", "2201-01", "2026-10-01", "", 202610, null]) {
      expect(parseYearMonth(raw), String(raw)).toBeNull();
    }
  });

  it("is what the proxy turns into a real 404", () => {
    expect(namesNoMonth("/month/2026-13")).toBe(true);
    expect(namesNoMonth("/month/nope")).toBe(true);
    expect(namesNoMonth("/month/%E0%A4%A")).toBe(true);
    expect(namesNoMonth("/month/2026-10")).toBe(false);
    expect(namesNoMonth("/month/2026-10/")).toBe(false);
    expect(namesNoMonth("/month")).toBe(false);
    expect(namesNoMonth("/day/2026-13-01")).toBe(false);
  });
});

describe("monthGrid", () => {
  it("starts on the week's first day, Monday, and runs whole weeks", () => {
    const days = monthGrid(ym("2026-10"));
    expect(days[0]).toBe("2026-09-28");
    expect(days.at(-1)).toBe("2026-11-01");
    expect(days).toHaveLength(35);
    expect(new Set(days).size).toBe(35);
  });

  it("draws six weeks only when the month needs them", () => {
    // 1 August 2026 is a Saturday, so 31 days reach a sixth week.
    const august = monthGrid(ym("2026-08"));
    expect(august).toHaveLength(42);
    expect([august[0], august.at(-1)]).toEqual(["2026-07-27", "2026-09-06"]);
  });

  it("keeps five weeks for a February that fits in four", () => {
    // 1 February 2027 is a Monday and the month is 28 days long.
    const february = monthGrid(ym("2027-02"));
    expect(february).toHaveLength(35);
    expect([february[0], february.at(-1)]).toEqual(["2027-02-01", "2027-03-07"]);
  });

  it("crosses a year", () => {
    const days = monthGrid(ym("2027-01"));
    expect(days[0]).toBe("2026-12-28");
    expect(addMonths(ym("2026-12"), 1)).toBe("2027-01");
    expect(addMonths(ym("2027-01"), -1)).toBe("2026-12");
  });
});

describe("monthRange", () => {
  it("reads from the evening before the grid to its end, at local midnights, in a month the clocks change", () => {
    const days = monthGrid(ym("2026-03"));
    const span = monthRange(days, "America/New_York");
    expect(span.fromDate).toBe("2026-02-22");
    expect(span.toDate).toBe("2026-04-06");
    expect(span.from).toEqual(dayRangeFor(d("2026-02-22"), "America/New_York").from);
    expect(span.from.toISOString()).toBe("2026-02-22T05:00:00.000Z");
    // After the spring change New York is UTC-4.
    expect(span.to.toISOString()).toBe("2026-04-06T04:00:00.000Z");
  });
});

describe("buildMonth", () => {
  it("puts a day-only item on its date and a timed one on the day it starts, with its time", () => {
    const b = build("2026-10", [makeItem({ title: "Pay rent", schedule: { kind: "day", on: d("2026-10-01") } }), timed("2026-10-14", 570, 630, "UTC", { title: "Dentist" })]);
    expect(cell(b, "2026-10-01").marks.map((m) => [m.title, m.time, m.movable])).toEqual([["Pay rent", null, true]]);
    expect(cell(b, "2026-10-14").marks.map((m) => [m.title, m.time])).toEqual([["Dentist", "09:30"]]);
    expect(b.cells.filter((c) => c.marks.length).map((c) => c.date)).toEqual(["2026-10-01", "2026-10-14"]);
  });

  it("shows an event that runs past midnight on both days, movable only where it starts", () => {
    const late = timed("2026-10-09", 22 * 60, 25 * 60, "Europe/London", { title: "Night train", type: "event" });
    const b = build("2026-10", [late], { timeZone: "Europe/London" });
    expect(cell(b, "2026-10-09").marks.map((m) => [m.time, m.movable])).toEqual([["22:00", true]]);
    expect(cell(b, "2026-10-10").marks.map((m) => [m.time, m.movable])).toEqual([["to 01:00", false]]);
    expect(cell(b, "2026-10-11").marks).toEqual([]);
  });

  it("ends a span at midnight on the day before, not on the day it touches", () => {
    const b = build("2026-10", [timed("2026-10-09", 20 * 60, 24 * 60)]);
    expect(cell(b, "2026-10-10").marks).toEqual([]);
  });

  it("draws the first day of the grid for an event that began the evening before it", () => {
    const b = build("2026-10", [timed("2026-09-27", 23 * 60, 26 * 60, "UTC", { title: "Overnight" })]);
    expect(cell(b, "2026-09-28").marks.map((m) => [m.title, m.time, m.movable])).toEqual([["Overnight", "to 02:00", false]]);
  });

  it("places a timed item by the user's zone across the spring and autumn changes", () => {
    const ny = "America/New_York";
    // 23:30 on 7 March is 04:30 UTC on the 8th, the day the clocks go forward.
    const before = timed("2026-03-07", 23 * 60 + 30, 23 * 60 + 45, ny, { title: "Before" });
    const skipped = timed("2026-03-08", 3 * 60, 4 * 60, ny, { title: "Skipped hour" });
    const b = build("2026-03", [before, skipped], { timeZone: ny });
    expect(cell(b, "2026-03-07").marks.map((m) => [m.title, m.time])).toEqual([["Before", "23:30"]]);
    expect(cell(b, "2026-03-08").marks.map((m) => [m.title, m.time])).toEqual([["Skipped hour", "03:00"]]);

    const repeated = timed("2026-11-01", 90, 150, ny, { title: "Repeated hour" });
    const fall = build("2026-11", [repeated], { timeZone: ny });
    expect(cell(fall, "2026-11-01").marks.map((m) => [m.title, m.time])).toEqual([["Repeated hour", "01:30"]]);
    expect(cell(fall, "2026-10-31").marks).toEqual([]);
    expect(cell(fall, "2026-11-02").marks).toEqual([]);
  });

  it("keeps London's short and long days whole", () => {
    const london = "Europe/London";
    const spring = build("2026-03", [timed("2026-03-29", 30, 3 * 60, london)], { timeZone: london });
    expect(cell(spring, "2026-03-29").marks.map((m) => m.time)).toEqual(["00:30"]);
    expect(cell(spring, "2026-03-30").marks).toEqual([]);
    const autumn = build("2026-10", [timed("2026-10-25", 23 * 60, 23 * 60 + 59, london)], { timeZone: london });
    expect(cell(autumn, "2026-10-25").marks.map((m) => m.time)).toEqual(["23:00"]);
    expect(cell(autumn, "2026-10-26").marks).toEqual([]);
  });

  it("orders a day's day-only items by area, then timed ones by start, and sends at most three", () => {
    const home: Area = { id: "a-home" as AreaId, name: "Home", position: 1, color: null };
    const work: Area = { id: "a-work" as AreaId, name: "Work", position: 0, color: "slate" };
    const on = { kind: "day" as const, on: d("2026-10-20") };
    const items = [
      timed("2026-10-20", 600, 660, "UTC", { title: "Ten" }),
      timed("2026-10-20", 480, 540, "UTC", { title: "Eight" }),
      makeItem({ title: "No area", schedule: on }),
      makeItem({ title: "Home thing", schedule: on, areaId: home.id }),
      makeItem({ title: "Work thing", schedule: on, areaId: work.id }),
    ];
    const c = cell(build("2026-10", items, { areas: [home, work] }), "2026-10-20");
    expect(c.marks).toHaveLength(MARKS_PER_DAY);
    expect(c.marks.map((m) => [m.title, m.area, m.areaColor])).toEqual([
      ["Work thing", "Work", "slate"],
      ["Home thing", "Home", null],
      ["No area", null, null],
    ]);
    expect(c.more).toBe(2);
  });

  it("leaves out notes, dropped items and anything with no day", () => {
    const on = { kind: "day" as const, on: d("2026-10-20") };
    const b = build("2026-10", [
      makeItem({ type: "note", schedule: on }),
      makeItem({ status: "dropped", schedule: on }),
      makeItem({ title: "Waiting" }),
    ]);
    expect(b.cells.every((c) => c.marks.length === 0 && c.more === 0)).toBe(true);
  });

  it("marks a due date, folded into the plan when both fall on one day", () => {
    const planned = makeItem({ title: "Report", schedule: { kind: "day", on: d("2026-10-22") }, dueOn: d("2026-10-22") });
    const waiting = makeItem({ title: "Visa", dueOn: d("2026-10-23") });
    const elsewhere = makeItem({ title: "Tax", schedule: { kind: "day", on: d("2026-10-05") }, dueOn: d("2026-10-30") });
    const b = build("2026-10", [planned, elsewhere], { due: [planned, waiting, elsewhere] });
    expect(cell(b, "2026-10-22").marks.map((m) => [m.title, m.due, m.movable])).toEqual([["Report", true, true]]);
    expect(cell(b, "2026-10-23").marks.map((m) => [m.title, m.due, m.movable, m.time])).toEqual([["Visa", true, false, null]]);
    expect(cell(b, "2026-10-30").marks.map((m) => [m.title, m.due])).toEqual([["Tax", true]]);
    expect(cell(b, "2026-10-05").marks.map((m) => [m.title, m.due])).toEqual([["Tax", false]]);
    expect(b.due).toBe(3);
  });

  it("counts open items that start in the month, not the days around it", () => {
    const b = build("2026-10", [
      makeItem({ schedule: { kind: "day", on: d("2026-10-02") } }),
      makeItem({ schedule: { kind: "day", on: d("2026-10-03") }, status: "done" }),
      makeItem({ schedule: { kind: "day", on: d("2026-09-29") } }),
      timed("2026-10-31", 23 * 60, 25 * 60),
    ]);
    expect(b.open).toBe(2);
    expect(monthSummary(b.open, b.due)).toBe("2 open this month.");
    expect(monthSummary(0, 1)).toBe("Nothing open this month. 1 due.");
  });

  it("draws state by line form: done and live are told apart from planned", () => {
    const live = timed("2026-10-14", 11 * 60, 13 * 60, "UTC", { title: "Now" });
    const done = makeItem({ title: "Done", schedule: { kind: "day", on: d("2026-10-14") }, status: "done" });
    const states = Object.fromEntries(cell(build("2026-10", [live, done]), "2026-10-14").marks.map((m) => [m.title, m.state]));
    expect(states).toEqual({ Done: "done", Now: "live" });
  });
});

describe("month navigation", () => {
  it("steps months and stays inside the span", () => {
    const today = d("2026-10-14");
    expect(monthNavTarget("next", ym("2026-12"), today)).toBe("2027-01");
    expect(monthNavTarget("previous", ym("2026-01"), today)).toBe("2025-12");
    expect(monthNavTarget("today", ym("2030-05"), today)).toBe("2026-10");
    expect(monthNavTarget("previous", ym("1970-01"), today)).toBe("1970-01");
    expect(monthNavTarget("next", ym("2200-12"), today)).toBe("2200-12");
    expect(monthHref(ym("2026-10"), today)).toBe("/month");
    expect(monthHref(ym("2026-11"), today)).toBe("/month/2026-11");
  });

  it("moves the grid's focus by day, week, week end and month", () => {
    expect(gridStep("ArrowRight", 0)).toEqual({ days: 1 });
    expect(gridStep("ArrowUp", 10)).toEqual({ days: -7 });
    expect(gridStep("Home", 10)).toEqual({ days: -3 });
    expect(gridStep("End", 10)).toEqual({ days: 3 });
    expect(gridStep("PageDown", 10)).toEqual({ months: 1 });
    expect(gridStep("a", 10)).toBeNull();
  });

  it("keeps the day of the month when paging, or takes the last day of a shorter month", () => {
    expect(sameDayIn(d("2026-01-31"), 1)).toBe("2026-02-28");
    expect(sameDayIn(d("2028-03-31"), -1)).toBe("2028-02-29");
    expect(sameDayIn(d("2026-10-14"), -1)).toBe("2026-09-14");
    expect(sameDayIn(d("2026-12-05"), 1)).toBe("2027-01-05");
  });
});
