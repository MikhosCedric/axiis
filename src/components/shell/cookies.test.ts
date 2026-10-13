import { describe, expect, it } from "vitest";
import { readDensity, readTheme } from "./cookies";

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
