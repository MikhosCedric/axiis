import { describe, expect, it } from "vitest";
import { SECTIONS, currentSection } from "./sections";

const stacked = [
  { top: 100, bottom: 600 },
  { top: 600, bottom: 1100 },
  { top: 1100, bottom: 1500 },
];

describe("currentSection", () => {
  it("is the section whose box spans the probe", () => {
    expect(currentSection(stacked, 300)).toBe(0);
    expect(currentSection(stacked, 700)).toBe(1);
    expect(currentSection(stacked, 1499)).toBe(2);
  });

  it("hands over at the shared edge to the section below", () => {
    expect(currentSection(stacked, 600)).toBe(1);
  });

  it("is none above the first, below the last, or between two", () => {
    expect(currentSection(stacked, 50)).toBe(-1);
    expect(currentSection(stacked, 1500)).toBe(-1);
    expect(currentSection([{ top: 0, bottom: 100 }, { top: 200, bottom: 300 }], 150)).toBe(-1);
  });
});

describe("SECTIONS", () => {
  it("letters the movements A to E in order, each with its own address", () => {
    expect(SECTIONS.map((s) => s.letter).join("")).toBe("ABCDE");
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length);
  });
});
