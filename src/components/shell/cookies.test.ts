import { describe, expect, it } from "vitest";
import { readDensity } from "./cookies";

describe("readDensity", () => {
  it("reads compact, and treats anything else as spacious", () => {
    expect(readDensity("compact")).toBe("compact");
    expect(readDensity("spacious")).toBe("spacious");
    expect(readDensity(undefined)).toBe("spacious");
    expect(readDensity("tiny")).toBe("spacious");
    expect(readDensity("Compact")).toBe("spacious");
  });
});
