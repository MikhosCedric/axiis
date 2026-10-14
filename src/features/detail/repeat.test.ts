import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { REPEAT_PRESETS, describeRule, presetOf, ruleFor, startsRepeating, weekdayOf } from "./repeat";

const d = (s: string) => s as LocalDate;
const never = { kind: "never" } as const;

describe("presets", () => {
  it("every preset reads back as itself", () => {
    for (const preset of REPEAT_PRESETS) {
      if (preset === "none") continue;
      expect(presetOf(ruleFor(preset, never))).toBe(preset);
    }
  });

  it("a rule the menu cannot make has no preset", () => {
    expect(presetOf({ freq: "weekly", interval: 1, byDay: ["MO", "WE"], end: never })).toBeNull();
    expect(presetOf({ freq: "daily", interval: 3, end: never })).toBeNull();
  });
});

describe("describeRule", () => {
  it.each<[Rule, string]>([
    [ruleFor("daily", never), "Every day"],
    [ruleFor("weekdays", never), "Every weekday"],
    [ruleFor("weekly", never), "Every week on Tuesday"],
    [ruleFor("biweekly", { kind: "count", count: 6 }), "Every 2 weeks on Tuesday, 6 times"],
    [ruleFor("monthly", { kind: "until", on: d("2026-12-31") }), "Every month, until Thursday 31 December"],
    [ruleFor("yearly", { kind: "count", count: 1 }), "Every year, once"],
    [{ freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: never }, "Every week on Monday, Wednesday and Friday"],
  ])("%j reads as %s", (rule, text) => {
    expect(describeRule(rule, d("2026-10-06"), d("2026-10-06"))).toBe(text);
  });

  it("names the year of an end that is not in this year, either way", () => {
    const until = (on: string) => ruleFor("weekly", { kind: "until", on: d(on) });
    const today = d("2026-10-06");
    expect(describeRule(until("2027-01-07"), today, today)).toBe("Every week on Tuesday, until Thursday 7 January 2027");
    expect(describeRule(until("2025-12-31"), d("2025-10-07"), today)).toBe("Every week on Tuesday, until Wednesday 31 December 2025");
    expect(describeRule(until("2026-12-31"), today, today)).toBe("Every week on Tuesday, until Thursday 31 December");
  });

  it("names weekdays from a local date", () => {
    expect(["2026-10-05", "2026-10-11"].map((s) => weekdayOf(d(s)))).toEqual(["MO", "SU"]);
  });
});

describe("startsRepeating", () => {
  const today = d("2026-10-06");

  it("says a waiting item repeats from today, and a planned one from its own day", () => {
    expect(startsRepeating({ preset: "daily", end: never }, null, today)).toBe("Repeats every day from today.");
    expect(startsRepeating({ preset: "weekly", end: never }, d("2026-10-08"), today)).toBe(
      "Repeats every week on Thursday from Thursday 8 October.",
    );
    expect(startsRepeating({ preset: "weekdays", end: never }, d("2026-10-07"), today)).toBe("Repeats every weekday from tomorrow.");
  });

  it("names the first occurrence when its own day is not one", () => {
    const saturday = d("2026-10-10");
    expect(startsRepeating({ preset: "weekdays", end: never }, saturday, saturday)).toBe(
      "Repeats every weekday, starting Monday 12 October.",
    );
    expect(startsRepeating({ preset: "weekdays", end: never }, null, d("2026-10-11"))).toBe("Repeats every weekday, starting tomorrow.");
  });

  it("says plainly that months or years without its date are skipped", () => {
    const monthly = { preset: "monthly", end: never } as const;
    expect(startsRepeating(monthly, d("2026-10-31"), today)).toBe(
      "Repeats every month from Saturday 31 October. Months with no 31st are skipped.",
    );
    expect(startsRepeating(monthly, d("2026-10-29"), today)).toMatch(/ Months with no 29th are skipped\.$/);
    expect(startsRepeating(monthly, d("2026-10-30"), today)).toMatch(/ Months with no 30th are skipped\.$/);
    expect(startsRepeating(monthly, d("2026-10-28"), today)).toBe("Repeats every month from Wednesday 28 October.");
    expect(startsRepeating({ preset: "yearly", end: never }, d("2028-02-29"), today)).toMatch(/ Years with no 29 February are skipped\.$/);
    expect(describeRule(ruleFor("monthly", { kind: "count", count: 6 }), d("2026-10-31"), today)).toBe(
      "Every month, 6 times. Months with no 31st are skipped.",
    );
  });

  it("says nothing when it stops repeating", () => {
    expect(startsRepeating({ preset: "none", end: never }, null, today)).toBeNull();
  });
});
