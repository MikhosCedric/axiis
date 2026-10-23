import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { spanHrefs } from "./span";

const today = "2026-10-23" as LocalDate;

describe("spanHrefs", () => {
  it("names today's day, week and month by their short addresses", () => {
    expect(spanHrefs(today, today)).toEqual({ day: "/today", week: "/week", month: "/month" });
  });

  it("goes to the day, the week holding it and the month holding it", () => {
    expect(spanHrefs("2026-12-02" as LocalDate, today)).toEqual({
      day: "/day/2026-12-02",
      week: "/week/2026-11-30",
      month: "/month/2026-12",
    });
  });

  it("keeps the day's List view", () => {
    expect(spanHrefs("2026-12-02" as LocalDate, today, "list").day).toBe("/day/2026-12-02?view=list");
  });

  it("names the month a week's Monday falls in from that Monday", () => {
    expect(spanHrefs("2026-09-28" as LocalDate, today).month).toBe("/month/2026-09");
  });
});
