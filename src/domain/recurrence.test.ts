import { describe, expect, it } from "vitest";
import type { LocalDate } from "./item";
import { WEEKDAYS, nextNthWeekday, nthWeekdayOn, nthsOf, parseRule, serializeRule, type Rule } from "./recurrence";

const d = (s: string) => s as LocalDate;

describe("parseRule", () => {
  it.each<[string, Rule]>([
    ["FREQ=DAILY", { freq: "daily", interval: 1, end: { kind: "never" } }],
    ["FREQ=WEEKLY", { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } }],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,MO", { freq: "weekly", interval: 2, byDay: ["MO", "WE"], end: { kind: "never" } }],
    ["FREQ=MONTHLY;UNTIL=20261231", { freq: "monthly", interval: 1, end: { kind: "until", on: d("2026-12-31") } }],
    ["COUNT=1000;FREQ=YEARLY;INTERVAL=99", { freq: "yearly", interval: 99, end: { kind: "count", count: 1000 } }],
  ])("reads %s", (raw, rule) => {
    expect(parseRule(raw)).toEqual(rule);
  });

  it.each([
    ["empty", ""],
    ["no FREQ", "INTERVAL=2"],
    ["unknown FREQ", "FREQ=HOURLY"],
    ["lowercase", "freq=daily"],
    ["BYSETPOS", "FREQ=MONTHLY;BYSETPOS=-1"],
    ["BYHOUR", "FREQ=DAILY;BYHOUR=9"],
    ["EXDATE", "FREQ=DAILY;EXDATE=20261010"],
    ["BYMONTHDAY", "FREQ=MONTHLY;BYMONTHDAY=15"],
    ["a repeated key", "FREQ=DAILY;FREQ=WEEKLY"],
    ["interval zero", "FREQ=DAILY;INTERVAL=0"],
    ["interval 100", "FREQ=DAILY;INTERVAL=100"],
    ["count zero", "FREQ=DAILY;COUNT=0"],
    ["count 1001", "FREQ=DAILY;COUNT=1001"],
    ["UNTIL and COUNT", "FREQ=DAILY;UNTIL=20261231;COUNT=3"],
    ["UNTIL with a time", "FREQ=DAILY;UNTIL=20261231T000000Z"],
    ["UNTIL not a real date", "FREQ=DAILY;UNTIL=20260230"],
    ["BYDAY on a daily rule", "FREQ=DAILY;BYDAY=MO"],
    ["BYDAY ordinal", "FREQ=WEEKLY;BYDAY=1MO"],
    ["BYDAY repeated", "FREQ=WEEKLY;BYDAY=MO,MO"],
    ["a trailing separator", "FREQ=DAILY;"],
    ["an RRULE: prefix", "RRULE:FREQ=DAILY"],
    ["too long", `FREQ=DAILY;${"X".repeat(200)}`],
  ])("rejects %s", (_, raw) => {
    expect(parseRule(raw)).toBeNull();
  });
});

describe("serializeRule", () => {
  it.each<[Rule, string]>([
    [{ freq: "daily", interval: 1, end: { kind: "never" } }, "FREQ=DAILY"],
    [{ freq: "weekly", interval: 2, byDay: ["FR", "MO"], end: { kind: "count", count: 5 } }, "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;COUNT=5"],
    [{ freq: "yearly", interval: 1, end: { kind: "until", on: d("2030-02-28") } }, "FREQ=YEARLY;UNTIL=20300228"],
  ])("writes the canonical form", (rule, raw) => {
    expect(serializeRule(rule)).toBe(raw);
    expect(parseRule(raw)).toEqual({ ...rule, ...(rule.freq === "weekly" && { byDay: ["MO", "FR"] }) });
  });

  it("matches the database allowlist", () => {
    // Copied from supabase/migrations/0013_nth_weekday_rules.sql: either pattern passes.
    const allow =
      /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=[1-9][0-9]?)?(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU)){0,6})?(;UNTIL=[0-9]{8}|;COUNT=[1-9][0-9]{0,3})?$|^FREQ=MONTHLY(;INTERVAL=[1-9][0-9]?)?;BYDAY=(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)(;UNTIL=[0-9]{8}|;COUNT=[1-9][0-9]{0,3})?$/;
    const rules: Rule[] = [
      { freq: "monthly", interval: 1, onThe: { nth: 2, day: "TU" }, end: { kind: "never" } },
      { freq: "monthly", interval: 99, onThe: { nth: -1, day: "FR" }, end: { kind: "until", on: d("2027-01-01") } },
      { freq: "monthly", interval: 3, onThe: { nth: 4, day: "SU" }, end: { kind: "count", count: 1000 } },
      { freq: "weekly", interval: 99, byDay: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"], end: { kind: "until", on: d("2027-01-01") } },
      { freq: "monthly", interval: 3, end: { kind: "count", count: 1000 } },
      { freq: "daily", interval: 1, end: { kind: "never" } },
    ];
    for (const rule of rules) expect(serializeRule(rule)).toMatch(allow);
  });
});

describe("a monthly rule on a weekday by its place", () => {
  it.each<[string, Rule]>([
    ["FREQ=MONTHLY;BYDAY=1MO", { freq: "monthly", interval: 1, onThe: { nth: 1, day: "MO" }, end: { kind: "never" } }],
    ["FREQ=MONTHLY;BYDAY=-1FR", { freq: "monthly", interval: 1, onThe: { nth: -1, day: "FR" }, end: { kind: "never" } }],
    [
      "FREQ=MONTHLY;INTERVAL=3;BYDAY=4SU;COUNT=8",
      { freq: "monthly", interval: 3, onThe: { nth: 4, day: "SU" }, end: { kind: "count", count: 8 } },
    ],
    [
      "FREQ=MONTHLY;BYDAY=2TU;UNTIL=20271231",
      { freq: "monthly", interval: 1, onThe: { nth: 2, day: "TU" }, end: { kind: "until", on: d("2027-12-31") } },
    ],
  ])("reads and writes %s", (raw, rule) => {
    expect(parseRule(raw)).toEqual(rule);
    expect(serializeRule(rule)).toBe(raw);
  });

  it("a plain monthly rule carries no place", () => {
    expect(parseRule("FREQ=MONTHLY")).toStrictEqual({ freq: "monthly", interval: 1, end: { kind: "never" } });
  });

  it.each([
    ["a fifth weekday", "FREQ=MONTHLY;BYDAY=5MO"],
    ["the second to last", "FREQ=MONTHLY;BYDAY=-2MO"],
    ["a zeroth", "FREQ=MONTHLY;BYDAY=0MO"],
    ["a plus sign", "FREQ=MONTHLY;BYDAY=+1MO"],
    ["two weekdays", "FREQ=MONTHLY;BYDAY=1MO,3MO"],
    ["a weekday with no place", "FREQ=MONTHLY;BYDAY=MO"],
    ["a place on a yearly rule", "FREQ=YEARLY;BYDAY=1MO"],
    ["a place on a daily rule", "FREQ=DAILY;BYDAY=-1FR"],
  ])("rejects %s", (_, raw) => {
    expect(parseRule(raw)).toBeNull();
  });

  it("finds the weekday in a month", () => {
    // October 2026 starts on a Thursday.
    expect(nthWeekdayOn(2026, 10, { nth: 1, day: "TH" })).toBe("2026-10-01");
    expect(nthWeekdayOn(2026, 10, { nth: 1, day: "WE" })).toBe("2026-10-07");
    expect(nthWeekdayOn(2026, 10, { nth: 2, day: "TU" })).toBe("2026-10-13");
    expect(nthWeekdayOn(2026, 10, { nth: 4, day: "SA" })).toBe("2026-10-24");
    expect(nthWeekdayOn(2026, 10, { nth: -1, day: "SA" })).toBe("2026-10-31");
    expect(nthWeekdayOn(2026, 10, { nth: -1, day: "FR" })).toBe("2026-10-30");
    expect(nthWeekdayOn(2026, 10, { nth: -1, day: "SU" })).toBe("2026-10-25");
    expect(nthWeekdayOn(2026, 12, { nth: -1, day: "TH" })).toBe("2026-12-31");
  });

  it("finds the last weekday of February in and out of a leap year", () => {
    expect(nthWeekdayOn(2028, 2, { nth: -1, day: "TU" })).toBe("2028-02-29");
    expect(nthWeekdayOn(2028, 2, { nth: -1, day: "MO" })).toBe("2028-02-28");
    expect(nthWeekdayOn(2027, 2, { nth: -1, day: "SU" })).toBe("2027-02-28");
    expect(nthWeekdayOn(2027, 2, { nth: -1, day: "MO" })).toBe("2027-02-22");
    // February 2027 has exactly four of every weekday, so the fourth is the last.
    expect(nthWeekdayOn(2027, 2, { nth: 4, day: "MO" })).toBe("2027-02-22");
  });

  it("agrees with counting the month's days, for every month of eight years", () => {
    for (let year = 2024; year < 2032; year++) {
      for (let month = 1; month <= 12; month++) {
        for (const day of WEEKDAYS) {
          const found: string[] = [];
          for (let n = 1; n <= 31; n++) {
            const t = new Date(Date.UTC(year, month - 1, n));
            if (t.getUTCMonth() === month - 1 && WEEKDAYS[(t.getUTCDay() + 6) % 7] === day) found.push(t.toISOString().slice(0, 10));
          }
          for (const nth of [1, 2, 3, 4] as const) expect(nthWeekdayOn(year, month, { nth, day })).toBe(found[nth - 1]);
          expect(nthWeekdayOn(year, month, { nth: -1, day })).toBe(found.at(-1));
        }
      }
    }
  });

  it("finds the next one on or after a date, into the next month or year", () => {
    const secondTue = { nth: 2, day: "TU" } as const;
    expect(nextNthWeekday(secondTue, d("2026-10-01"))).toBe("2026-10-13");
    expect(nextNthWeekday(secondTue, d("2026-10-13"))).toBe("2026-10-13");
    expect(nextNthWeekday(secondTue, d("2026-10-14"))).toBe("2026-11-10");
    expect(nextNthWeekday({ nth: 1, day: "MO" }, d("2026-12-08"))).toBe("2027-01-04");
  });

  it("names the places a date holds", () => {
    expect(nthsOf(d("2026-10-01"))).toEqual([1]);
    expect(nthsOf(d("2026-10-14"))).toEqual([2]);
    expect(nthsOf(d("2026-10-24"))).toEqual([4]);
    expect(nthsOf(d("2026-10-25"))).toEqual([4, -1]);
    expect(nthsOf(d("2026-10-30"))).toEqual([-1]);
    // Every day of the last week of a 28-day February is both a fourth and the last.
    expect(nthsOf(d("2027-02-22"))).toEqual([4, -1]);
    expect(nthsOf(d("2028-02-22"))).toEqual([4]);
    expect(nthsOf(d("2028-02-29"))).toEqual([-1]);
    for (const on of ["2026-10-14", "2026-10-25", "2027-02-22", "2028-02-29"]) {
      const [year, month] = on.split("-").map(Number);
      const day = WEEKDAYS[(new Date(`${on}T00:00:00Z`).getUTCDay() + 6) % 7];
      for (const nth of nthsOf(d(on))) expect(nthWeekdayOn(year, month, { nth, day })).toBe(on);
    }
  });
});
