import { describe, expect, it } from "vitest";
import { headerClock } from "@/lib/clock";
import {
  CLOCK_SETTINGS,
  clockCookieValue,
  readClock,
  readDensity,
  readFocus,
  readReminders,
  readStartPage,
  readTheme,
  readTour,
  readWeekStart,
  START_PAGES,
  startPath,
  weekStartSetting,
} from "./cookies";

describe("readWeekStart", () => {
  it("is Monday unless Sunday was chosen, and writes back the word it read", () => {
    expect(readWeekStart(undefined)).toBe(1);
    expect(readWeekStart("monday")).toBe(1);
    expect(readWeekStart("0")).toBe(1);
    expect(readWeekStart("sunday")).toBe(0);
    expect(weekStartSetting(readWeekStart("sunday"))).toBe("sunday");
    expect(weekStartSetting(readWeekStart(undefined))).toBe("monday");
  });
});

describe("readStartPage", () => {
  it("opens one of a fixed set of pages, Today for anything else, so a cookie can never lead off the app", () => {
    expect(readStartPage(undefined)).toBe("today");
    expect(readStartPage("inbox")).toBe("inbox");
    for (const odd of ["", "//evil.example", "/week", "settings", "https://x.test"]) expect(readStartPage(odd)).toBe("today");
    expect(START_PAGES.map(startPath)).toEqual(["/today", "/week", "/month", "/inbox", "/due"]);
  });
});

describe("readReminders", () => {
  it("keeps desktop reminders on unless they were turned off", () => {
    expect(readReminders(undefined)).toBe(true);
    expect(readReminders("on")).toBe(true);
    expect(readReminders("nonsense")).toBe(true);
    expect(readReminders("off")).toBe(false);
  });
});

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

  it("with no clock said yet, writes the clock the request's first language uses", () => {
    expect(readClock(undefined, headerClock("en-US,en;q=0.9"))).toEqual({ setting: "auto", clock: "12" });
    expect(readClock(undefined, headerClock("en-GB,en;q=0.9"))).toEqual({ setting: "auto", clock: "24" });
    expect(readClock("auto-24", headerClock("en-US"))).toEqual({ setting: "auto", clock: "24" });
    expect(readClock("24", headerClock("en-US"))).toEqual({ setting: "24", clock: "24" });
    expect(headerClock(null)).toBe("24");
    expect(headerClock("*")).toBe("24");
    expect(headerClock("not a language!")).toBe("24");
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
