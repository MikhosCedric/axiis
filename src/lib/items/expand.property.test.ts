import { RRule } from "rrule";
import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate, Schedule, SpanRange } from "@/domain/item";
import { WEEKDAYS, type Rule, type RuleEnd } from "@/domain/recurrence";
import { addDays, dayRangeFor, instantAt, localMinutes, toLocalDate } from "@/lib/dates";
import { MAX_OCCURRENCES, expandSeries, type Occurrence, type SeriesSource } from "./expand";

const ID = "00000000-0000-4000-8000-0000000000aa" as ItemId;
const DAY_MS = 86_400_000;
const floating = (date: LocalDate) => new Date(`${date}T00:00:00Z`);
const FREQ = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY } as const;
const DAYS = { MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH, FR: RRule.FR, SA: RRule.SA, SU: RRule.SU };

/** The expansion before fast-forwarding: the rule always runs from the series' first date. */
function fromFirstDate(series: SeriesSource, span: SpanRange, timeZone: string): Occurrence[] {
  const s = series.schedule;
  if (s.kind === "unscheduled") return [];
  const firstOn = s.kind === "day" ? s.on : toLocalDate(s.start, timeZone);
  const minutes = s.kind === "timed" ? localMinutes(s.start, firstOn, timeZone) : 0;
  const length = s.kind === "timed" ? s.end.getTime() - s.start.getTime() : 0;
  const { rule } = series;
  const rrule = new RRule({
    freq: FREQ[rule.freq],
    interval: rule.interval,
    dtstart: floating(firstOn),
    wkst: RRule.MO,
    ...(rule.freq === "weekly" && rule.byDay.length > 0 && { byweekday: rule.byDay.map((d) => DAYS[d]) }),
    ...(rule.end.kind === "until" && { until: floating(rule.end.on) }),
    ...(rule.end.kind === "count" && { count: rule.end.count }),
  });
  const dates = rrule.between(floating(span.fromDate), new Date(floating(span.toDate).getTime() - DAY_MS / 2), true, (_, i) => i < MAX_OCCURRENCES);
  return dates.map((d) => {
    const originalOn = d.toISOString().slice(0, 10) as LocalDate;
    if (s.kind === "day") return { seriesId: series.id, originalOn, schedule: { kind: "day", on: originalOn } };
    const start = instantAt(originalOn, minutes, timeZone);
    return { seriesId: series.id, originalOn, schedule: { kind: "timed", start, end: new Date(start.getTime() + length) } };
  });
}

/** mulberry32: a small seeded generator, so a failure names a case that reruns. */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]) => xs[int(0, xs.length - 1)];
  return { next, int, pick };
}

const ZONES = ["UTC", "America/New_York", "Europe/London", "Australia/Sydney", "Asia/Kolkata", "America/Santiago", "Pacific/Chatham"];
// The 1st, the 29th to the 31st, and the days around the clock changes in the zones above.
const DAYS_OF_INTEREST = ["01-01", "01-31", "02-28", "02-29", "03-08", "03-29", "03-31", "04-05", "09-06", "10-04", "10-25", "11-01", "12-31"];

function arbitrary(seed: number) {
  const r = random(seed);
  const tz = r.pick(ZONES);
  const year = r.int(2000, 2030);
  const picked = r.next() < 0.3 ? `${year}-${r.pick(DAYS_OF_INTEREST)}` : addDays(`${year}-01-01` as LocalDate, r.int(0, 364));
  const isRealDate = !Number.isNaN(floating(picked as LocalDate).getTime()) && floating(picked as LocalDate).toISOString().startsWith(picked);
  const valid = (isRealDate ? picked : `${year}-02-28`) as LocalDate;

  const freq = r.pick(["daily", "daily", "weekly", "weekly", "monthly", "yearly"] as const);
  const interval = r.next() < 0.6 ? 1 : r.next() < 0.8 ? r.int(2, 9) : r.int(10, 99);
  const endKind = r.pick(["never", "never", "until", "count"] as const);
  const end: RuleEnd =
    endKind === "never"
      ? { kind: "never" }
      : endKind === "until"
        ? { kind: "until", on: addDays(valid, r.int(0, 6000)) }
        : { kind: "count", count: r.next() < 0.5 ? r.int(1, 30) : r.int(1, 1000) };
  const noDays = r.next() < 0.3;
  const rule: Rule =
    freq === "weekly" ? { freq, interval, end, byDay: noDays ? [] : WEEKDAYS.filter(() => r.next() < 0.4) } : { freq, interval, end };

  const kind = r.pick(["day", "timed", "timed"] as const);
  // Minutes include 01:30 and 02:30, which some of the zones skip or repeat on a change night.
  const minutes = r.pick([0, 90, 150, 540, 1410, r.int(0, 1439)]);
  const start = instantAt(valid, minutes, tz);
  const schedule: Schedule =
    kind === "day" ? { kind: "day", on: valid } : { kind: "timed", start, end: new Date(start.getTime() + r.int(1, 600) * 60_000) };

  const fromDate = addDays(valid, r.next() < 0.15 ? r.int(-60, 0) : r.int(0, 8000));
  const toDate = addDays(fromDate, r.pick([1, 1, 7, 7, 31, 42, r.int(1, 500)]));
  const span: SpanRange = { from: dayRangeFor(fromDate, tz).from, to: dayRangeFor(toDate, tz).from, fromDate, toDate };
  return { series: { id: ID, schedule, rule }, span, tz };
}

const comparable = (os: Occurrence[]) =>
  os.map((o) => [o.originalOn, o.schedule.kind === "timed" ? `${o.schedule.start.toISOString()}/${o.schedule.end.toISOString()}` : o.schedule.on]);

describe("expandSeries fast-forward", () => {
  it("returns what running the rule from its first date returns, over generated rules, spans and zones", () => {
    let nonEmpty = 0;
    for (let seed = 1; seed <= 2500; seed++) {
      const { series, span, tz } = arbitrary(seed);
      const expected = comparable(fromFirstDate(series, span, tz));
      if (expected.length > 0) nonEmpty++;
      expect({ seed, got: comparable(expandSeries(series, span, tz)) }).toEqual({ seed, got: expected });
    }
    expect(nonEmpty).toBeGreaterThan(800);
  });

  it("spends a count on the occurrences it skips", () => {
    const tz = "America/New_York";
    for (const rule of [
      { freq: "daily", interval: 3, end: { kind: "count", count: 10 } },
      { freq: "weekly", interval: 2, byDay: ["MO", "TH"], end: { kind: "count", count: 10 } },
      { freq: "weekly", interval: 1, byDay: [], end: { kind: "count", count: 10 } },
    ] as Rule[]) {
      const series = { id: ID, schedule: { kind: "day", on: "2026-03-05" as LocalDate } as Schedule, rule };
      const span = (fromDate: LocalDate, toDate: LocalDate): SpanRange => ({
        from: dayRangeFor(fromDate, tz).from,
        to: dayRangeFor(toDate, tz).from,
        fromDate,
        toDate,
      });
      const all = expandSeries(series, span("2026-03-01" as LocalDate, "2027-03-01" as LocalDate), tz).map((o) => o.originalOn);
      expect(all).toHaveLength(10);
      const last = all[9];
      expect(expandSeries(series, span(last, addDays(last, 1)), tz).map((o) => o.originalOn)).toEqual([last]);
      expect(expandSeries(series, span(addDays(last, 1), addDays(last, 400)), tz)).toEqual([]);
    }
  });
});
