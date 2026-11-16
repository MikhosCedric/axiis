import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { parseRule, serializeRule, type Rule } from "@/domain/recurrence";
import {
  REPEAT_PRESETS,
  customOf,
  customRule,
  describeRule,
  firstOccurrence,
  monthlyChoices,
  presetOf,
  repeatSchema,
  ruleFor,
  settledRule,
  startsRepeating,
  weekdayOf,
  type CustomRepeat,
  type RepeatChoice,
} from "./repeat";

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
    expect(presetOf({ freq: "monthly", interval: 1, onThe: { nth: 1, day: "MO" }, end: never })).toBeNull();
  });
});

describe("the editor's reading of a rule", () => {
  // Tuesday 6 October 2026.
  const firstOn = d("2026-10-06");
  const ends: Rule["end"][] = [never, { kind: "count", count: 7 }, { kind: "until", on: d("2027-03-01") }];

  it("every rule capture or the menu can make goes into the editor and comes back the same", () => {
    const rules: Rule[] = ends.flatMap((end): Rule[] => [
      ...REPEAT_PRESETS.flatMap((p) => (p === "none" ? [] : [ruleFor(p, end)])),
      { freq: "daily", interval: 3, end },
      { freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end },
      { freq: "weekly", interval: 3, byDay: ["SA", "SU"], end },
      { freq: "weekly", interval: 4, byDay: [], end },
      { freq: "monthly", interval: 3, end },
      { freq: "monthly", interval: 1, onThe: { nth: 1, day: "TU" }, end },
      { freq: "monthly", interval: 2, onThe: { nth: -1, day: "FR" }, end },
      { freq: "yearly", interval: 2, end },
    ]);
    for (const rule of rules) {
      const back = settledRule(customRule(customOf(rule, firstOn), rule.end), firstOn);
      expect(back).toStrictEqual(rule);
      expect(parseRule(serializeRule(back))).toStrictEqual(rule);
      expect(repeatSchema.safeParse({ preset: "custom", custom: customOf(rule, firstOn), end: rule.end }).success).toBe(true);
    }
  });

  it("shows a plain weekly rule on its first day's weekday, and stores that one day as plain again", () => {
    expect(customOf(ruleFor("weekly", never), firstOn).byDay).toEqual(["TU"]);
    expect(settledRule({ freq: "weekly", interval: 1, byDay: ["TU"], end: never }, firstOn)).toEqual(ruleFor("weekly", never));
    expect(settledRule({ freq: "weekly", interval: 1, byDay: ["WE"], end: never }, firstOn)).toMatchObject({ byDay: ["WE"] });
  });

  it("keeps weekdays for weeks only and a place for months only", () => {
    const custom: CustomRepeat = { freq: "daily", interval: 2, byDay: ["MO"], onThe: { nth: 1, day: "MO" } };
    expect(customRule(custom, never)).toStrictEqual({ freq: "daily", interval: 2, end: never });
    expect(customRule({ ...custom, freq: "weekly" }, never)).toStrictEqual({ freq: "weekly", interval: 2, byDay: ["MO"], end: never });
    expect(customRule({ ...custom, freq: "monthly", onThe: null }, never)).toStrictEqual({ freq: "monthly", interval: 2, end: never });
  });

  it("refuses what is not a repeat", () => {
    const custom = { freq: "weekly", interval: 1, byDay: ["TU"], onThe: null };
    const bad = [
      { ...custom, interval: 0 },
      { ...custom, interval: 100 },
      { ...custom, interval: 1.5 },
      { ...custom, freq: "hourly" },
      { ...custom, byDay: ["XX"] },
      { ...custom, onThe: { nth: 5, day: "MO" } },
      { ...custom, onThe: { nth: -2, day: "MO" } },
    ];
    for (const c of bad) expect(repeatSchema.safeParse({ preset: "custom", custom: c }).success).toBe(false);
    expect(repeatSchema.safeParse({ preset: "custom" }).success).toBe(false);
  });

  it("offers where in the month a monthly repeat can fall, read off its first day", () => {
    const labels = (on: string, current: Parameters<typeof monthlyChoices>[1] = null) => monthlyChoices(d(on), current).map((m) => m.label);
    expect(labels("2026-11-14")).toEqual(["On day 14", "On the second Saturday"]);
    expect(labels("2026-10-06")).toEqual(["On day 6", "On the first Tuesday"]);
    // The 27th of November 2026 is the fourth Friday and the last.
    expect(labels("2026-11-27")).toEqual(["On day 27", "On the fourth Friday", "On the last Friday"]);
    // A fifth is only ever the last.
    expect(labels("2026-10-30")).toEqual(["On day 30", "On the last Friday"]);
    // A place the first day has moved off is still shown, so it is not lost by opening the editor.
    expect(labels("2026-11-14", { nth: 1, day: "MO" })).toEqual(["On day 14", "On the second Saturday", "On the first Monday"]);
    expect(monthlyChoices(d("2026-11-14"), null).map((m) => m.value)).toEqual(["day", "2SA"]);
  });

  it("starts a weekday of the month on the next one", () => {
    const rule: Rule = { freq: "monthly", interval: 1, onThe: { nth: 2, day: "TU" }, end: never };
    expect(firstOccurrence(rule, d("2026-10-06"))).toBe("2026-10-13");
    expect(firstOccurrence(rule, d("2026-10-13"))).toBe("2026-10-13");
    expect(firstOccurrence(rule, d("2026-10-14"))).toBe("2026-11-10");
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
    [{ freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: never }, "Every week on Mon, Wed, Fri"],
    [{ freq: "weekly", interval: 3, byDay: ["MO", "WE", "FR"], end: never }, "Every 3 weeks on Mon, Wed, Fri"],
    [{ freq: "weekly", interval: 1, byDay: ["MO", "TH"], end: never }, "Every week on Monday and Thursday"],
    [{ freq: "daily", interval: 3, end: never }, "Every 3 days"],
    [{ freq: "monthly", interval: 1, onThe: { nth: 2, day: "TU" }, end: never }, "Every second Tuesday of the month"],
    [{ freq: "monthly", interval: 1, onThe: { nth: -1, day: "FR" }, end: { kind: "count", count: 4 } }, "Every last Friday of the month, 4 times"],
    [{ freq: "monthly", interval: 3, onThe: { nth: 1, day: "MO" }, end: never }, "Every 3 months on the first Monday"],
  ])("%j reads as %s", (rule, text) => {
    expect(describeRule(rule, d("2026-10-06"), d("2026-10-06"))).toBe(text);
  });

  it("a weekday by its place never skips a month, so it says nothing of skipping", () => {
    const rule: Rule = { freq: "monthly", interval: 1, onThe: { nth: -1, day: "SA" }, end: never };
    expect(describeRule(rule, d("2026-10-31"), d("2026-10-06"))).toBe("Every last Saturday of the month");
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

  it("reads a hand-built repeat, and names the first date a weekday of the month falls on", () => {
    const custom = (c: Partial<CustomRepeat>): RepeatChoice => ({
      preset: "custom",
      custom: { freq: "weekly", interval: 1, byDay: ["TU"], onThe: null, ...c },
      end: never,
    });
    expect(startsRepeating(custom({ interval: 3, byDay: ["MO", "WE", "FR"] }), today, today)).toBe(
      "Repeats every 3 weeks on Mon, Wed, Fri, starting tomorrow.",
    );
    // 6 October 2026 is the first Tuesday.
    expect(startsRepeating(custom({ freq: "monthly", onThe: { nth: 1, day: "TU" } }), today, today)).toBe(
      "Repeats every first Tuesday of the month from today.",
    );
    expect(startsRepeating(custom({ freq: "monthly", onThe: { nth: 2, day: "TU" } }), today, today)).toBe(
      "Repeats every second Tuesday of the month, starting Tuesday 13 October.",
    );
  });

  it("says nothing when it stops repeating", () => {
    expect(startsRepeating({ preset: "none", end: never }, null, today)).toBeNull();
  });
});
