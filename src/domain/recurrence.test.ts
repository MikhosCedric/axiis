import { describe, expect, it } from "vitest";
import type { LocalDate } from "./item";
import { parseRule, serializeRule, type Rule } from "./recurrence";

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
    // Copied from supabase/migrations/0004_recurrence.sql.
    const allow =
      /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=[1-9][0-9]?)?(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU)){0,6})?(;UNTIL=[0-9]{8}|;COUNT=[1-9][0-9]{0,3})?$/;
    const rules: Rule[] = [
      { freq: "weekly", interval: 99, byDay: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"], end: { kind: "until", on: d("2027-01-01") } },
      { freq: "monthly", interval: 3, end: { kind: "count", count: 1000 } },
      { freq: "daily", interval: 1, end: { kind: "never" } },
    ];
    for (const rule of rules) expect(serializeRule(rule)).toMatch(allow);
  });
});
