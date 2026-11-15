import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { dayCount, doneHeading, doneSummary, groupByDay, readPages, type DoneRow } from "./model";

const d = (s: string) => s as LocalDate;
const today = d("2026-10-08");
const row = (title: string, doneOn: string) => ({ title, doneOn: d(doneOn) }) as DoneRow;

describe("groupByDay", () => {
  it("cuts newest-first rows into one section per day, keeping their order", () => {
    const days = groupByDay([row("a", "2026-10-08"), row("b", "2026-10-08"), row("c", "2026-10-07"), row("d", "2026-10-01")], today);
    expect(days.map((g) => [g.heading, g.rows.map((r) => r.title)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["Thursday 1 October", ["d"]],
    ]);
  });

  it("gives a day from another year its year, and nothing for no rows", () => {
    expect(doneHeading(d("2025-12-31"), today)).toBe("Wednesday 31 December 2025");
    expect(groupByDay([], today)).toEqual([]);
  });
});

describe("readPages", () => {
  it("is one unless the address names a whole number, and stops at the read's cap", () => {
    expect(readPages(undefined)).toBe(1);
    expect(readPages("x")).toBe(1);
    expect(readPages("0")).toBe(1);
    expect(readPages("2.5")).toBe(1);
    expect(readPages("3")).toBe(3);
    expect(readPages(["4", "5"])).toBe(4);
    expect(readPages("999")).toBe(10);
  });
});

describe("words", () => {
  it("counts plainly, without praise", () => {
    expect(dayCount(1)).toBe("1 item");
    expect(dayCount(3)).toBe("3 items");
    expect(doneSummary(0, false)).toBe("Nothing finished yet.");
    expect(doneSummary(12, false)).toBe("12 items finished.");
    expect(doneSummary(50, true)).toBe("The latest 50 you finished.");
  });
});
