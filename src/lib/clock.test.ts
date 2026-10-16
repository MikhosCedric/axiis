import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { formatClock, formatHour, formatMinutes, parseClock } from "./clock";
import { instantAt } from "./dates";

const at = (date: string, minutes: number, tz: string) => instantAt(date as LocalDate, minutes, tz);
const spaced = (s: string) => s.replace(/ /g, " ");

describe("formatMinutes", () => {
  it("writes the 24-hour clock with two-digit hours", () => {
    expect(formatMinutes(0, "24")).toBe("00:00");
    expect(formatMinutes(570, "24")).toBe("09:30");
    expect(formatMinutes(720, "24")).toBe("12:00");
    expect(formatMinutes(1439, "24")).toBe("23:59");
  });

  it("writes the 12-hour clock with midnight as 12 AM and noon as 12 PM", () => {
    expect(spaced(formatMinutes(0, "12"))).toBe("12:00 AM");
    expect(spaced(formatMinutes(5, "12"))).toBe("12:05 AM");
    expect(spaced(formatMinutes(570, "12"))).toBe("9:30 AM");
    expect(spaced(formatMinutes(719, "12"))).toBe("11:59 AM");
    expect(spaced(formatMinutes(720, "12"))).toBe("12:00 PM");
    expect(spaced(formatMinutes(780, "12"))).toBe("1:00 PM");
    expect(spaced(formatMinutes(1439, "12"))).toBe("11:59 PM");
  });

  it("keeps AM and PM on the time's line", () => {
    expect(formatMinutes(570, "12")).toBe("9:30 AM");
  });

  it("wraps past midnight either way", () => {
    expect(formatMinutes(1440 + 60, "24")).toBe("01:00");
    expect(spaced(formatMinutes(1440, "12"))).toBe("12:00 AM");
    expect(formatMinutes(-30, "24")).toBe("23:30");
  });
});

describe("formatHour", () => {
  it("labels the axis compactly on each clock", () => {
    expect(formatHour(9, "24")).toBe("09");
    expect(formatHour(24, "24")).toBe("00");
    expect(spaced(formatHour(0, "12"))).toBe("12 AM");
    expect(spaced(formatHour(9, "12"))).toBe("9 AM");
    expect(spaced(formatHour(12, "12"))).toBe("12 PM");
    expect(spaced(formatHour(13, "12"))).toBe("1 PM");
    expect(spaced(formatHour(24, "12"))).toBe("12 AM");
  });

  it("is never wider than 5 characters, so 76px an hour holds it", () => {
    for (let h = 0; h <= 24; h++) expect(formatHour(h, "12").length).toBeLessThanOrEqual(5);
  });
});

describe("formatClock", () => {
  it("writes the wall clock in the given zone", () => {
    const nineThirty = at("2026-10-06", 570, "America/New_York");
    expect(formatClock(nineThirty, "America/New_York", "24")).toBe("09:30");
    expect(spaced(formatClock(nineThirty, "America/New_York", "12"))).toBe("9:30 AM");
    expect(formatClock(nineThirty, "Europe/London", "24")).toBe("14:30");
    expect(spaced(formatClock(nineThirty, "Europe/London", "12"))).toBe("2:30 PM");
  });

  it("follows the clocks across a change of time", () => {
    // New York springs forward at 02:00 on 8 March 2026: an hour after 01:30 reads 03:30.
    const before = at("2026-03-08", 90, "America/New_York");
    const after = new Date(before.getTime() + 60 * 60_000);
    expect(spaced(formatClock(before, "America/New_York", "12"))).toBe("1:30 AM");
    expect(spaced(formatClock(after, "America/New_York", "12"))).toBe("3:30 AM");
    expect(formatClock(after, "America/New_York", "24")).toBe("03:30");
    // It falls back at 02:00 on 1 November 2026: an hour after 01:30 reads 01:30 again.
    const first = at("2026-11-01", 90, "America/New_York");
    const again = new Date(first.getTime() + 60 * 60_000);
    expect(spaced(formatClock(again, "America/New_York", "12"))).toBe("1:30 AM");
  });

  it("writes midnight and noon on the 12-hour clock", () => {
    expect(spaced(formatClock(at("2026-10-06", 0, "Asia/Tokyo"), "Asia/Tokyo", "12"))).toBe("12:00 AM");
    expect(spaced(formatClock(at("2026-10-06", 720, "Asia/Tokyo"), "Asia/Tokyo", "12"))).toBe("12:00 PM");
    expect(formatClock(at("2026-10-06", 0, "Asia/Tokyo"), "Asia/Tokyo", "24")).toBe("00:00");
  });
});

describe("parseClock", () => {
  it("reads the 24-hour clock typed loosely", () => {
    expect(parseClock("14:30")).toBe(870);
    expect(parseClock("14.30")).toBe(870);
    expect(parseClock("1430")).toBe(870);
    expect(parseClock("930")).toBe(570);
    expect(parseClock("9")).toBe(540);
    expect(parseClock("00:00")).toBe(0);
    expect(parseClock(" 21:30 ")).toBe(1290);
  });

  it("reads the 12-hour clock in the ways people write it", () => {
    expect(parseClock("9am")).toBe(540);
    expect(parseClock("9 AM")).toBe(540);
    expect(parseClock("9:30pm")).toBe(1290);
    expect(parseClock("9:30 PM")).toBe(1290);
    expect(parseClock("9:30 PM")).toBe(1290);
    expect(parseClock("9.30 p.m.")).toBe(1290);
    expect(parseClock("930p")).toBe(1290);
    expect(parseClock("12am")).toBe(0);
    expect(parseClock("12:15 AM")).toBe(15);
    expect(parseClock("12pm")).toBe(720);
    expect(parseClock("12:45 PM")).toBe(765);
  });

  it("reads back everything it writes", () => {
    for (let m = 0; m < 1440; m += 7) {
      expect(parseClock(formatMinutes(m, "12"))).toBe(m);
      expect(parseClock(formatMinutes(m, "24"))).toBe(m);
    }
  });

  it("refuses what no clock shows", () => {
    for (const bad of ["", "24:00", "9:60", "13pm", "0am", "noon", "9:3", "abc", "9 xm", "123456"]) expect(parseClock(bad)).toBeNull();
  });
});
