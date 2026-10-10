import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { addDays, dayRangeFor, instantAt, isSameDay, localMinutes, outOfRange, parseLocalDate, resolveTimeZone, toLocalDate } from "./dates";

const d = (s: string) => s as LocalDate;
const hours = (r: { from: Date; to: Date }) => (r.to.getTime() - r.from.getTime()) / 3_600_000;

describe("dayRangeFor", () => {
  it("is the plain UTC day in UTC", () => {
    const r = dayRangeFor(d("2026-10-06"), "UTC");
    expect(r).toEqual({
      date: "2026-10-06",
      from: new Date("2026-10-06T00:00:00Z"),
      to: new Date("2026-10-07T00:00:00Z"),
    });
  });

  it("starts at local midnight in a negative offset", () => {
    const r = dayRangeFor(d("2026-07-01"), "America/New_York");
    expect(r.from.toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-07-02T04:00:00.000Z");
  });

  it("is 23 hours on the spring-forward day", () => {
    const r = dayRangeFor(d("2026-03-08"), "America/New_York");
    expect(r.from.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(hours(r)).toBe(23);
  });

  it("is 25 hours on the fall-back day", () => {
    const r = dayRangeFor(d("2026-11-01"), "America/New_York");
    expect(r.from.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(hours(r)).toBe(25);
  });

  it("handles a half-hour offset", () => {
    const r = dayRangeFor(d("2026-10-06"), "Asia/Kolkata");
    expect(r.from.toISOString()).toBe("2026-10-05T18:30:00.000Z");
    expect(hours(r)).toBe(24);
  });

  it("handles a half-hour offset on its DST start day", () => {
    const r = dayRangeFor(d("2026-10-04"), "Australia/Adelaide");
    expect(r.from.toISOString()).toBe("2026-10-03T14:30:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-04T13:30:00.000Z");
    expect(hours(r)).toBe(23);
  });

  it("starts at the transition when local midnight does not exist", () => {
    // Santiago springs forward at 00:00, so 2026-09-06 begins at 01:00 local.
    const r = dayRangeFor(d("2026-09-06"), "America/Santiago");
    expect(r.from.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(toLocalDate(r.from, "America/Santiago")).toBe("2026-09-06");
    expect(toLocalDate(new Date(r.from.getTime() - 1), "America/Santiago")).toBe("2026-09-05");
  });

  it("tiles consecutive days with no gap or overlap", () => {
    const a = dayRangeFor(d("2026-03-28"), "Europe/London");
    const b = dayRangeFor(d("2026-03-29"), "Europe/London");
    const c = dayRangeFor(d("2026-03-30"), "Europe/London");
    expect(a.to).toEqual(b.from);
    expect(b.to).toEqual(c.from);
    expect(hours(b)).toBe(23);
  });

  it("crosses month and year ends", () => {
    const r = dayRangeFor(d("2026-12-31"), "Pacific/Auckland");
    expect(r.from.toISOString()).toBe("2026-12-30T11:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-12-31T11:00:00.000Z");
  });
});

describe("toLocalDate", () => {
  it("reads the calendar date in the given zone", () => {
    const now = new Date("2026-10-06T20:00:00Z");
    expect(toLocalDate(now, "UTC")).toBe("2026-10-06");
    expect(toLocalDate(now, "Asia/Kolkata")).toBe("2026-10-07");
    expect(toLocalDate(now, "Pacific/Honolulu")).toBe("2026-10-06");
  });

  it("flips exactly at local midnight in a half-hour zone", () => {
    expect(toLocalDate(new Date("2026-10-05T18:29:59.999Z"), "Asia/Kolkata")).toBe("2026-10-05");
    expect(toLocalDate(new Date("2026-10-05T18:30:00.000Z"), "Asia/Kolkata")).toBe("2026-10-06");
  });
});

describe("localMinutes and instantAt", () => {
  const iso = (date: string, minutes: number, zone: string) => instantAt(d(date), minutes, zone).toISOString();

  it("reads and builds wall-clock times on an ordinary day", () => {
    expect(iso("2026-07-01", 9 * 60 + 30, "America/New_York")).toBe("2026-07-01T13:30:00.000Z");
    expect(localMinutes(new Date("2026-07-01T13:30:00Z"), d("2026-07-01"), "America/New_York")).toBe(570);
    expect(iso("2026-10-06", 0, "Asia/Kolkata")).toBe("2026-10-05T18:30:00.000Z");
  });

  it("counts minutes on the next local day past 1440 and on the previous day below zero", () => {
    expect(localMinutes(new Date("2026-10-07T00:30:00Z"), d("2026-10-06"), "UTC")).toBe(1470);
    expect(localMinutes(new Date("2026-10-05T23:00:00Z"), d("2026-10-06"), "UTC")).toBe(-60);
  });

  it("puts 00:00 and 24:00 exactly on the ends of the day range, DST days included", () => {
    for (const [date, zone] of [
      ["2026-03-08", "America/New_York"],
      ["2026-11-01", "America/New_York"],
      ["2026-10-04", "Australia/Adelaide"],
    ] as const) {
      expect(instantAt(d(date), 0, zone)).toEqual(dayRangeFor(d(date), zone).from);
      expect(instantAt(d(date), 1440, zone)).toEqual(dayRangeFor(d(date), zone).to);
    }
  });

  it("round-trips every quarter hour on both DST change days except the skipped hour", () => {
    for (const date of ["2026-03-08", "2026-11-01"]) {
      for (let m = 0; m < 1440; m += 15) {
        if (date === "2026-03-08" && m >= 120 && m < 180) continue;
        expect(localMinutes(instantAt(d(date), m, "America/New_York"), d(date), "America/New_York")).toBe(m);
      }
    }
  });

  it("moves a time in the spring-forward gap forward by the gap", () => {
    expect(iso("2026-03-08", 2 * 60 + 30, "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
    expect(iso("2026-03-08", 3 * 60, "America/New_York")).toBe("2026-03-08T07:00:00.000Z");
  });

  it("resolves the repeated hour on the fall-back day to its first occurrence", () => {
    expect(iso("2026-11-01", 90, "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
    expect(iso("2026-11-01", 120, "America/New_York")).toBe("2026-11-01T07:00:00.000Z");
  });

  it("keeps wall-clock spacing across the fall-back hour, so 01:00 to 03:00 lasts three real hours", () => {
    const start = instantAt(d("2026-11-01"), 60, "America/New_York");
    const end = instantAt(d("2026-11-01"), 180, "America/New_York");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(3);
  });

  it("starts the day at 01:00 when local midnight does not exist", () => {
    expect(iso("2026-09-06", 0, "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
    const from = dayRangeFor(d("2026-09-06"), "America/Santiago").from;
    expect(localMinutes(from, d("2026-09-06"), "America/Santiago")).toBe(60);
  });
});

describe("resolveTimeZone", () => {
  it("keeps a valid IANA zone", () => {
    expect(resolveTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("falls back to UTC for missing or bogus input", () => {
    expect(resolveTimeZone(undefined)).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
    expect(resolveTimeZone("Mars/Olympus")).toBe("UTC");
    expect(resolveTimeZone("x".repeat(500))).toBe("UTC");
  });
});

describe("addDays", () => {
  it("steps across month and year ends in both directions", () => {
    expect(addDays(d("2026-01-31"), 1)).toBe("2026-02-01");
    expect(addDays(d("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(d("2027-01-01"), -1)).toBe("2026-12-31");
    expect(addDays(d("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("lands on and steps over a leap day", () => {
    expect(addDays(d("2028-02-28"), 1)).toBe("2028-02-29");
    expect(addDays(d("2028-02-29"), 1)).toBe("2028-03-01");
    expect(addDays(d("2028-03-01"), -1)).toBe("2028-02-29");
  });

  it("is a calendar step, unaffected by daylight saving", () => {
    expect(addDays(d("2026-03-08"), 1)).toBe("2026-03-09");
    expect(addDays(d("2026-10-06"), 0)).toBe("2026-10-06");
    expect(addDays(d("2026-10-06"), 365)).toBe("2027-10-06");
  });

  it("keeps years below 100 as written", () => {
    expect(addDays(d("0050-12-31"), 1)).toBe("0051-01-01");
  });
});

describe("parseLocalDate", () => {
  it("accepts real calendar dates", () => {
    expect(parseLocalDate("2026-10-06")).toBe("2026-10-06");
    expect(parseLocalDate("2028-02-29")).toBe("2028-02-29");
    expect(parseLocalDate("2000-02-29")).toBe("2000-02-29");
    expect(parseLocalDate("1970-01-01")).toBe("1970-01-01");
    expect(parseLocalDate("2200-12-31")).toBe("2200-12-31");
  });

  it("rejects real dates outside the span Axiis plans on, and says so", () => {
    for (const raw of ["1969-12-31", "0050-01-01", "2201-01-01", "9999-12-31"]) {
      expect(parseLocalDate(raw)).toBeNull();
      expect(outOfRange(raw)).toBe(true);
    }
    for (const raw of ["2026-10-06", "2026-02-30", "tomorrow", undefined]) expect(outOfRange(raw)).toBe(false);
  });

  it("rejects dates that do not exist", () => {
    for (const raw of ["2026-02-30", "2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00"]) {
      expect(parseLocalDate(raw)).toBeNull();
    }
  });

  it("rejects anything that is not strictly YYYY-MM-DD", () => {
    const bad = ["2026-10-6", "26-10-06", "2026/10/06", " 2026-10-06", "2026-10-06\n", "2026-10-06T00:00", "20261006", ""];
    for (const raw of [...bad, undefined, null, 20261006, ["2026-10-06"]]) {
      expect(parseLocalDate(raw)).toBeNull();
    }
  });
});

describe("isSameDay", () => {
  it("compares the date an instant falls on in the given zone", () => {
    const now = new Date("2026-10-06T20:00:00Z");
    expect(isSameDay(d("2026-10-06"), now, "UTC")).toBe(true);
    expect(isSameDay(d("2026-10-06"), now, "Asia/Kolkata")).toBe(false);
    expect(isSameDay(d("2026-10-07"), now, "Asia/Kolkata")).toBe(true);
  });
});
