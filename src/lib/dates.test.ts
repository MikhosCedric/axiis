import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { dayRangeFor, resolveTimeZone, toLocalDate } from "./dates";

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
