import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { formatDayShort } from "./format";

const day = (s: string) => s as LocalDate;

describe("formatDayShort", () => {
  it("reads a day in a few characters", () => {
    expect(formatDayShort(day("2026-10-07"), day("2026-10-01"))).toBe("Wed 7 Oct");
  });

  it("names the year only when it is not this year", () => {
    expect(formatDayShort(day("2027-01-07"), day("2026-12-30"))).toBe("Thu 7 Jan 2027");
  });
});
