import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { daysBetween, dueGroup, dueSummary, dueWords, GROUP_LABEL } from "./model";

const d = (s: string) => s as LocalDate;
const today = d("2026-10-08");

describe("daysBetween", () => {
  it("counts calendar days, across a month and a year end", () => {
    expect(daysBetween(d("2026-10-08"), d("2026-10-08"))).toBe(0);
    expect(daysBetween(d("2026-10-08"), d("2026-10-15"))).toBe(7);
    expect(daysBetween(d("2026-10-08"), d("2026-10-01"))).toBe(-7);
    expect(daysBetween(d("2026-12-30"), d("2027-01-02"))).toBe(3);
  });

  it("is not thrown by a clock change in the way", () => {
    expect(daysBetween(d("2026-10-24"), d("2026-10-26"))).toBe(2);
    expect(daysBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2);
  });
});

describe("dueGroup", () => {
  it("puts yesterday in the past, today and the six days after it in the week, and day seven later", () => {
    expect(dueGroup(d("2026-10-07"), today)).toBe("past");
    expect(dueGroup(d("2026-10-08"), today)).toBe("week");
    expect(dueGroup(d("2026-10-14"), today)).toBe("week");
    expect(dueGroup(d("2026-10-15"), today)).toBe("later");
  });

  it("labels the groups without dating a debt", () => {
    expect(Object.values(GROUP_LABEL)).toEqual(["Earlier", "This week", "Later"]);
    for (const label of Object.values(GROUP_LABEL)) expect(label).not.toMatch(/\b(due|late|overdue|missed|past)\b/i);
  });
});

describe("dueWords", () => {
  it("names today and tomorrow, and the date otherwise", () => {
    expect(dueWords(d("2026-10-08"), today, false)).toBe("Due today");
    expect(dueWords(d("2026-10-09"), today, false)).toBe("Due tomorrow");
    expect(dueWords(d("2026-10-15"), today, false)).toBe("Due Thursday 15 October");
  });

  it("says was due for an open item behind us, without counting how late", () => {
    expect(dueWords(d("2026-10-05"), today, false)).toBe("Was due Monday 5 October");
    expect(dueWords(d("2026-10-07"), today, false)).toBe("Was due Wednesday 7 October");
  });

  it("keeps a done item's date plain", () => {
    expect(dueWords(d("2026-10-05"), today, true)).toBe("Due Monday 5 October");
    expect(dueWords(d("2026-10-08"), today, true)).toBe("Was due today");
  });

  it("names the year when it is not this year's", () => {
    expect(dueWords(d("2027-01-07"), today, false)).toBe("Due Thursday 7 January 2027");
  });
});

describe("dueSummary", () => {
  const row = (group: "past" | "week" | "later", done = false) => ({ group, done });

  it("says when nothing has a due date, and when it is all done", () => {
    expect(dueSummary([])).toBe("Nothing has a due date.");
    expect(dueSummary([row("week", true), row("later", true)])).toBe("Everything with a due date is done.");
  });

  it("counts open items due this week, and past due ones when there are any", () => {
    expect(dueSummary([row("week")])).toBe("1 is due this week.");
    expect(dueSummary([row("week"), row("week"), row("later")])).toBe("2 are due this week.");
    expect(dueSummary([row("later")])).toBe("Nothing is due this week.");
    expect(dueSummary([row("past")])).toBe("1 past due, nothing due this week.");
    expect(dueSummary([row("past"), row("past"), row("week")])).toBe("2 past due, 1 is due this week.");
  });

  it("leaves done items out of the counts", () => {
    expect(dueSummary([row("week", true), row("week")])).toBe("1 is due this week.");
  });
});
