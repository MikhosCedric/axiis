import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { completeDatePhrase, parseDatePhrase } from "./date-phrase";

const d = (s: string) => s as LocalDate;
const TUESDAY = d("2026-10-06");
const SUNDAY = d("2026-10-11");
const parse = (text: string, today = TUESDAY) => parseDatePhrase(text, today);

describe("parseDatePhrase", () => {
  it("reads today, tomorrow and yesterday", () => {
    expect([parse("today"), parse("tomorrow"), parse("yesterday")]).toEqual(["2026-10-06", "2026-10-07", "2026-10-05"]);
  });

  it("crosses month, year and leap day boundaries by the calendar", () => {
    expect(parse("tomorrow", d("2026-12-31"))).toBe("2027-01-01");
    expect(parse("in 1 day", d("2028-02-28"))).toBe("2028-02-29");
    expect(parse("tomorrow", d("2026-03-07"))).toBe("2026-03-08");
    expect(parse("yesterday", d("2026-11-02"))).toBe("2026-11-01");
  });

  it("takes a bare weekday as the next one, today included", () => {
    expect(parse("tuesday")).toBe("2026-10-06");
    expect(parse("wed")).toBe("2026-10-07");
    expect(parse("Sunday")).toBe("2026-10-11");
    expect(parse("monday")).toBe("2026-10-12");
    expect(parse("monday", SUNDAY)).toBe("2026-10-12");
    expect(parse("sunday", SUNDAY)).toBe("2026-10-11");
  });

  it("takes next and a weekday as that day in next week", () => {
    expect(parse("next monday")).toBe("2026-10-12");
    expect(parse("next tuesday")).toBe("2026-10-13");
    expect(parse("next sunday")).toBe("2026-10-18");
    expect(parse("next monday", SUNDAY)).toBe("2026-10-12");
    expect(parse("next sunday", SUNDAY)).toBe("2026-10-18");
    expect(parse("next thurs")).toBe("2026-10-15");
  });

  it("counts days and weeks ahead", () => {
    expect(parse("in 3 days")).toBe("2026-10-09");
    expect(parse("in 0 days")).toBe("2026-10-06");
    expect(parse("in a day")).toBe("2026-10-07");
    expect(parse("in 2 weeks")).toBe("2026-10-20");
    expect(parse("in one week")).toBe("2026-10-13");
    expect(parse("in 30 days")).toBe("2026-11-05");
  });

  it("reads an ISO date, refusing one that is not on the calendar", () => {
    expect(parse("2026-12-24")).toBe("2026-12-24");
    expect(parse("1999-01-01")).toBe("1999-01-01");
    expect(parse("2026-02-30")).toBeNull();
    expect(parse("2026-13-01")).toBeNull();
  });

  it("reads a month and day in either order, as the next time it comes round", () => {
    expect(parse("dec 24")).toBe("2026-12-24");
    expect(parse("24 dec")).toBe("2026-12-24");
    expect(parse("December 24th")).toBe("2026-12-24");
    expect(parse("Dec. 24")).toBe("2026-12-24");
    expect(parse("oct 6")).toBe("2026-10-06");
    expect(parse("oct 5")).toBe("2027-10-05");
    expect(parse("jan 3")).toBe("2027-01-03");
    expect(parse("sept 1")).toBe("2027-09-01");
  });

  it("finds the next 29 February and refuses days no month has", () => {
    expect(parse("feb 29")).toBe("2028-02-29");
    expect(parse("feb 30")).toBeNull();
    expect(parse("apr 31")).toBeNull();
    expect(parse("dec 0")).toBeNull();
  });

  it("takes a given year as it is", () => {
    expect(parse("dec 24 2030")).toBe("2030-12-24");
    expect(parse("24 December, 2030")).toBe("2030-12-24");
    expect(parse("jan 3 2026")).toBe("2026-01-03");
    expect(parse("feb 29 2027")).toBeNull();
  });

  it("ignores case and extra spaces", () => {
    expect(parse("  NEXT   Monday ")).toBe("2026-10-12");
    expect(parse("In 3  Days")).toBe("2026-10-09");
  });

  it("names no date for anything else", () => {
    for (const text of ["", "dentist", "next", "next dentist", "in days", "in three days", "monday morning", "decx 24", "24", "call mum tomorrow"]) {
      expect(parse(text), text).toBeNull();
    }
  });
});

describe("completeDatePhrase", () => {
  it("finishes a word that can only be one phrase", () => {
    expect(completeDatePhrase("tom")).toBe("tomorrow");
    expect(completeDatePhrase("Yest")).toBe("yesterday");
    expect(completeDatePhrase("next tu")).toBe("next tuesday");
  });

  it("leaves short, exact and ambiguous words alone", () => {
    expect(completeDatePhrase("to")).toBeNull();
    expect(completeDatePhrase("today")).toBeNull();
    expect(completeDatePhrase("nex")).toBeNull();
    expect(completeDatePhrase("next t")).toBeNull();
    expect(completeDatePhrase("dentist")).toBeNull();
  });
});
