import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate, Schedule, SpanRange } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { addDays, dayRangeFor, localMinutes } from "@/lib/dates";
import { MAX_OCCURRENCES, expandSeries, liveOccurrences, type SeriesSource } from "./expand";

const ID = "00000000-0000-4000-8000-0000000000aa" as ItemId;
const OTHER = "00000000-0000-4000-8000-0000000000bb" as ItemId;
const d = (s: string) => s as LocalDate;
const never = { kind: "never" } as const;
const daily: Rule = { freq: "daily", interval: 1, end: never };

function span(fromDate: string, toDate: string, tz: string): SpanRange {
  return { from: dayRangeFor(d(fromDate), tz).from, to: dayRangeFor(d(toDate), tz).from, fromDate: d(fromDate), toDate: d(toDate) };
}
const timed = (start: string, end: string): Schedule => ({ kind: "timed", start: new Date(start), end: new Date(end) });
const onDay = (on: string): Schedule => ({ kind: "day", on: d(on) });
const series = (schedule: Schedule, rule: Rule, id = ID): SeriesSource => ({ id, schedule, rule });
const dates = (s: SeriesSource, sp: SpanRange, tz = "UTC") => expandSeries(s, sp, tz).map((o) => o.originalOn);
const starts = (s: SeriesSource, sp: SpanRange, tz: string) =>
  expandSeries(s, sp, tz).map((o) => (o.schedule.kind === "timed" ? o.schedule.start.toISOString() : o.schedule.on));

describe("expandSeries across daylight-saving changes", () => {
  it("keeps 09:00 in New York through the spring change", () => {
    const tz = "America/New_York";
    const s = series(timed("2026-03-06T14:00:00Z", "2026-03-06T15:00:00Z"), daily);
    expect(starts(s, span("2026-03-06", "2026-03-10", tz), tz)).toEqual([
      "2026-03-06T14:00:00.000Z",
      "2026-03-07T14:00:00.000Z",
      "2026-03-08T13:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
    ]);
  });

  it("keeps 09:00 in New York through the fall change, and keeps the length", () => {
    const tz = "America/New_York";
    const s = series(timed("2026-10-30T13:00:00Z", "2026-10-30T14:30:00Z"), daily);
    const occ = expandSeries(s, span("2026-10-31", "2026-11-03", tz), tz);
    expect(occ.map((o) => o.originalOn)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    for (const o of occ) {
      if (o.schedule.kind !== "timed") throw new Error("expected timed");
      expect(localMinutes(o.schedule.start, o.originalOn, tz)).toBe(540);
      expect(o.schedule.end.getTime() - o.schedule.start.getTime()).toBe(90 * 60_000);
    }
    expect(occ[1].schedule.kind === "timed" && occ[1].schedule.start.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("moves a 01:30 London item forward on the night the clocks skip it", () => {
    const tz = "Europe/London";
    const s = series(timed("2026-03-28T01:30:00Z", "2026-03-28T02:00:00Z"), daily);
    expect(starts(s, span("2026-03-28", "2026-03-31", tz), tz)).toEqual([
      "2026-03-28T01:30:00.000Z",
      // 01:30 does not exist on the 29th; clocks jump to 02:30 BST, which is 01:30 UTC.
      "2026-03-29T01:30:00.000Z",
      "2026-03-30T00:30:00.000Z",
    ]);
  });

  it("uses the first 01:30 in London on the night the clocks repeat it", () => {
    const tz = "Europe/London";
    const s = series(timed("2026-10-24T00:30:00Z", "2026-10-24T01:00:00Z"), daily);
    expect(starts(s, span("2026-10-24", "2026-10-27", tz), tz)).toEqual([
      "2026-10-24T00:30:00.000Z",
      "2026-10-25T00:30:00.000Z",
      "2026-10-26T01:30:00.000Z",
    ]);
  });

  it("holds a half-hour zone's wall clock (Kolkata)", () => {
    const tz = "Asia/Kolkata";
    // 00:15 local on the 5th is 18:45 UTC on the 4th: the occurrence dates are local, not UTC.
    const s = series(timed("2026-10-04T18:45:00Z", "2026-10-04T19:15:00Z"), daily);
    const occ = expandSeries(s, span("2026-10-05", "2026-10-07", tz), tz);
    expect(occ.map((o) => o.originalOn)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(starts(s, span("2026-10-05", "2026-10-07", tz), tz)).toEqual(["2026-10-04T18:45:00.000Z", "2026-10-05T18:45:00.000Z"]);
  });
});

describe("expandSeries calendar rules", () => {
  it("crosses a year boundary", () => {
    const s = series(onDay("2026-12-24"), { freq: "weekly", interval: 1, byDay: [], end: never });
    expect(dates(s, span("2026-12-28", "2027-01-11", "UTC"))).toEqual(["2026-12-31", "2027-01-07"]);
  });

  it("repeats a leap day only in leap years", () => {
    const s = series(onDay("2028-02-29"), { freq: "yearly", interval: 1, end: never });
    expect(dates(s, span("2028-01-01", "2037-01-01", "UTC"))).toEqual(["2028-02-29", "2032-02-29", "2036-02-29"]);
  });

  it("skips months with no 31st", () => {
    const s = series(onDay("2026-01-31"), { freq: "monthly", interval: 1, end: never });
    expect(dates(s, span("2026-01-01", "2026-08-01", "UTC"))).toEqual(["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31"]);
  });

  it("lands on each named weekday across a week", () => {
    // 2026-10-05 is a Monday.
    const s = series(onDay("2026-10-05"), { freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: never });
    expect(dates(s, span("2026-10-05", "2026-10-19", "UTC"))).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
    ]);
  });

  it("every weekday leaves out the weekend", () => {
    const s = series(onDay("2026-10-05"), { freq: "weekly", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"], end: never });
    expect(dates(s, span("2026-10-09", "2026-10-13", "UTC"))).toEqual(["2026-10-09", "2026-10-12"]);
  });

  it("honours an interval of 2", () => {
    expect(dates(series(onDay("2026-10-05"), { ...daily, interval: 2 }), span("2026-10-05", "2026-10-11", "UTC"))).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
    ]);
    const fortnightly = series(onDay("2026-10-05"), { freq: "weekly", interval: 2, byDay: ["MO", "TH"], end: never });
    expect(dates(fortnightly, span("2026-10-05", "2026-11-02", "UTC"))).toEqual(["2026-10-05", "2026-10-08", "2026-10-19", "2026-10-22"]);
  });

  it("stops after COUNT occurrences, counted from the first", () => {
    const s = series(onDay("2026-10-01"), { ...daily, end: { kind: "count", count: 3 } });
    expect(dates(s, span("2026-10-02", "2026-10-10", "UTC"))).toEqual(["2026-10-02", "2026-10-03"]);
  });

  it("stops after UNTIL, which is inclusive", () => {
    const s = series(timed("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z"), { ...daily, end: { kind: "until", on: d("2026-10-03") } });
    expect(dates(s, span("2026-09-28", "2026-10-10", "UTC"))).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("produces nothing when the series starts after the span", () => {
    expect(dates(series(onDay("2026-11-01"), daily), span("2026-10-01", "2026-10-08", "UTC"))).toEqual([]);
  });

  it("treats the span as half-open", () => {
    expect(dates(series(onDay("2026-10-01"), daily), span("2026-10-05", "2026-10-06", "UTC"))).toEqual(["2026-10-05"]);
  });

  it(`never returns more than ${MAX_OCCURRENCES}`, () => {
    const occ = expandSeries(series(onDay("2026-01-01"), daily), span("2026-01-01", "2030-01-01", "UTC"), "UTC");
    expect(occ).toHaveLength(MAX_OCCURRENCES);
    expect(occ.at(-1)?.originalOn).toBe(addDays(d("2026-01-01"), MAX_OCCURRENCES - 1));
  });

  it("returns nothing for a series with no schedule", () => {
    expect(dates(series({ kind: "unscheduled" }, daily), span("2026-10-01", "2026-10-08", "UTC"))).toEqual([]);
  });
});

describe("liveOccurrences", () => {
  const sp = span("2026-10-05", "2026-10-08", "UTC");
  const a = series(onDay("2026-10-01"), daily);
  const b = series(onDay("2026-10-01"), daily, OTHER);
  const keys = (claims: { seriesId: ItemId; originalOn: LocalDate }[]) =>
    liveOccurrences([a, b], claims, sp, "UTC").map((o) => `${o.seriesId === ID ? "a" : "b"} ${o.originalOn}`);

  it("suppresses exactly the claimed date of the claimed series", () => {
    expect(keys([{ seriesId: ID, originalOn: d("2026-10-06") }])).toEqual([
      "a 2026-10-05",
      "a 2026-10-07",
      "b 2026-10-05",
      "b 2026-10-06",
      "b 2026-10-07",
    ]);
  });

  it("ignores claims on dates the series does not produce", () => {
    expect(keys([{ seriesId: ID, originalOn: d("2026-09-01") }])).toHaveLength(6);
  });
});
