import { describe, expect, it } from "vitest";
import { COUNT_MS, countAt } from "./tally";

describe("a tally's count", () => {
  it("starts at nought and ends on the real number, which it never passes", () => {
    expect(countAt(20, 0)).toBe(0);
    expect(countAt(20, COUNT_MS)).toBe(20);
    expect(countAt(20, COUNT_MS * 3)).toBe(20);
    const seen = Array.from({ length: 50 }, (_, i) => countAt(20, (i / 49) * COUNT_MS));
    expect(seen.every((n, i) => Number.isInteger(n) && n <= 20 && (i === 0 || n >= seen[i - 1]))).toBe(true);
  });

  it("covers most of the way early, as an ease out does", () => {
    expect(countAt(100, COUNT_MS / 2)).toBeGreaterThan(80);
  });

  it("shows nought throughout for nothing", () => {
    expect([0, COUNT_MS / 2, COUNT_MS].map((ms) => countAt(0, ms))).toEqual([0, 0, 0]);
  });
});
