import { describe, expect, it } from "vitest";
import { CLOCK_SETTINGS, clockCookieValue, readClock, readDensity, readFocus, readTheme, readTour } from "./cookies";

describe("readFocus", () => {
  it("is on only when the device saved it on", () => {
    expect(readFocus("on")).toBe(true);
    expect(readFocus("off")).toBe(false);
    expect(readFocus(undefined)).toBe(false);
    expect(readFocus("On")).toBe(false);
  });
});

describe("readTour", () => {
  it("shows on a new account until finished, and on any account when asked for again", () => {
    expect(readTour(undefined, true)).toBe(true);
    expect(readTour("done", true)).toBe(false);
    expect(readTour(undefined, false)).toBe(false);
    expect(readTour("replay", false)).toBe(true);
    expect(readTour("replay", true)).toBe(true);
    expect(readTour("bogus", false)).toBe(false);
  });
});

describe("readDensity", () => {
  it("reads compact, and treats anything else as spacious", () => {
    expect(readDensity("compact")).toBe("compact");
    expect(readDensity("spacious")).toBe("spacious");
    expect(readDensity(undefined)).toBe("spacious");
    expect(readDensity("tiny")).toBe("spacious");
    expect(readDensity("Compact")).toBe("spacious");
  });
});

describe("readTheme", () => {
  it("reads light and dark, and treats anything else as following the device", () => {
    expect(readTheme("light")).toBe("light");
    expect(readTheme("dark")).toBe("dark");
    expect(readTheme(undefined)).toBe("system");
    expect(readTheme("system")).toBe("system");
    expect(readTheme("Dark")).toBe("system");
  });
});

describe("readClock", () => {
  it("reads a chosen clock, an inferred one under Auto, and 24-hour Auto for anything else", () => {
    expect(readClock("12")).toEqual({ setting: "12", clock: "12" });
    expect(readClock("24")).toEqual({ setting: "24", clock: "24" });
    expect(readClock("auto-12")).toEqual({ setting: "auto", clock: "12" });
    expect(readClock("auto-24")).toEqual({ setting: "auto", clock: "24" });
    expect(readClock(undefined)).toEqual({ setting: "auto", clock: "24" });
    expect(readClock("h12")).toEqual({ setting: "auto", clock: "24" });
  });

  it("round-trips every setting through the cookie value", () => {
    for (const setting of CLOCK_SETTINGS) {
      for (const device of ["12", "24"] as const) {
        const read = readClock(clockCookieValue(setting, device));
        expect(read).toEqual({ setting, clock: setting === "auto" ? device : setting });
      }
    }
  });
});
