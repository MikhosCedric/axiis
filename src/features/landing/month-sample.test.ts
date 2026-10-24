import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { sampleMarks } from "./month-sample";

const d = (s: string) => s as LocalDate;

describe("sampleMarks", () => {
  it("orders a day as the Month does: day-only, then timed by start, then due", () => {
    // 2026-10-23 is a Friday: the Friday run plus the 23rd's two items.
    expect(sampleMarks(d("2026-10-23")).map((m) => m.title)).toEqual(["Easy run", "Physio exercises", "Plan next week"]);
    // 2026-12-26 is a Saturday: Groceries (day-only) before the due date.
    expect(sampleMarks(d("2026-12-26"))).toEqual([
      { title: "Groceries", at: null, due: false },
      { title: "Quarterly summary", at: null, due: true },
    ]);
  });

  it("leaves a Sunday with no fixed day empty", () => {
    expect(sampleMarks(d("2026-10-25"))).toEqual([]);
  });
});
