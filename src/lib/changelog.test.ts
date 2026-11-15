import { describe, expect, it } from "vitest";
import { CHANGELOG, changelogDate } from "./changelog";

describe("CHANGELOG", () => {
  it("is newest first, with real dates, unique titles and plain words", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const e of CHANGELOG) {
      expect(e.date, e.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${e.date}T00:00:00Z`)), e.title).toBe(false);
      expect(`${e.title} ${e.body}`, e.title).not.toContain("!");
    }
    expect(new Set(CHANGELOG.map((e) => e.title)).size).toBe(CHANGELOG.length);
  });

  it("words a date in full", () => {
    expect(changelogDate("2026-11-09")).toBe("9 November 2026");
  });
});
