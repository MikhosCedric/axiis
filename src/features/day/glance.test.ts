import { describe, expect, it } from "vitest";
import type { Item, LocalDate, ShownItem } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { buildToday } from "@/features/today/model";
import { dayRangeFor } from "@/lib/dates";
import { dayGlance, foldedWords, glanceLine, relativeDay, spanLine } from "./glance";

const zone = "UTC";
const date = "2026-10-23" as LocalDate;
const at = (hh: number, mm = 0) => new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
const timed = (title: string, from: number, to: number, over: Partial<Item> = {}) =>
  makeItem({ title, schedule: { kind: "timed", start: at(from), end: at(to) }, ...over });
const anyTime = (title: string, over: Partial<Item> = {}) => makeItem({ title, schedule: { kind: "day", on: date }, ...over });
const clock = (d: Date) => d.toISOString().slice(11, 16);

function view(items: ShownItem[], now: Date, inbox: ShownItem[] = []) {
  return buildToday({ scheduled: items, unscheduled: inbox }, dayRangeFor(date, zone), now);
}

describe("relativeDay", () => {
  it("names a date from today", () => {
    expect(relativeDay(date, date)).toBe("Today");
    expect(relativeDay("2026-10-24" as LocalDate, date)).toBe("Tomorrow");
    expect(relativeDay("2026-10-22" as LocalDate, date)).toBe("Yesterday");
    expect(relativeDay("2026-10-26" as LocalDate, date)).toBe("In 3 days");
    expect(relativeDay("2026-10-20" as LocalDate, date)).toBe("3 days ago");
  });
});

describe("dayGlance", () => {
  const now = at(14, 20);
  const day = [
    timed("Run", 7, 8, { status: "done", completedAt: at(8) }),
    timed("Dentist", 12, 13),
    timed("Focus block", 14, 15),
    timed("Call the plumber", 18, 19),
    timed("Design sync", 16, 17, { type: "event" }),
    anyTime("Groceries"),
    anyTime("Send the invoice", { dueOn: date }),
  ];

  it("counts what is done, what has passed and what is due, and orders what comes next", () => {
    const g = dayGlance(view(day, now), date, date, now);
    expect(g).toMatchObject({ when: "Today", done: 1, total: 7, passed: 1, due: 1 });
    expect(g.next.map((e) => e.item.title)).toEqual(["Focus block", "Design sync", "Send the invoice"]);
    expect(g.nextTimed?.item.title).toBe("Design sync");
    expect(glanceLine(g, clock)).toBe("Today · 1 of 7 done · now: Focus block · next: Design sync at 16:00 · 1 due");
  });

  it("Focus keeps now, the next three by time and everything due, and counts what it folds away", () => {
    const inbox = [makeItem({ title: "Gift", dueOn: date }), makeItem({ title: "Lease" })];
    const g = dayGlance(view(day, now, inbox), date, date, now);
    expect(g.focus.map((e) => e.item.title)).toEqual(["Focus block", "Design sync", "Call the plumber", "Send the invoice", "Gift"]);
    // Dentist has passed and Groceries has no time and no due date: both fold away, with the Lease in the Inbox.
    expect(g.folded).toEqual({ planned: 2, inbox: 1 });
    expect(foldedWords(g, 2)).toBe("2 more planned · 1 in the Inbox · 2 left over · 1 done");
    expect(foldedWords({ ...g, done: 0, folded: { planned: 0, inbox: 0 } }, 0)).toBe("Nothing else");
  });

  it("counts an Inbox item due today, and never one due later", () => {
    const inbox = [makeItem({ title: "Gift", dueOn: date }), makeItem({ title: "Later", dueOn: "2026-10-30" as LocalDate })];
    const g = dayGlance(view([], now, inbox), date, date, now);
    expect(g.due).toBe(1);
    expect(g.next.map((e) => e.item.title)).toEqual(["Gift"]);
  });

  it("says nothing is left once every planned item is done", () => {
    const done = { status: "done" as const, completedAt: at(9) };
    const g = dayGlance(view([timed("Run", 7, 8, done), anyTime("Water", done)], now), date, date, now);
    expect(glanceLine(g, clock)).toBe("Today · Nothing left today");
    expect(g.next).toEqual([]);
  });

  it("on another day nothing has passed and the first time is next", () => {
    const tomorrow = "2026-10-24" as LocalDate;
    const g = dayGlance(view(day.slice(1, 3), now), tomorrow, date, now);
    // The day shown is tomorrow, so 12:00 has not passed even though now is later in the day.
    expect(g.passed).toBe(0);
    expect(glanceLine({ ...g, live: [] }, clock)).toBe("Tomorrow · 0 of 2 done · next: Dentist at 12:00");
  });

  it("on an empty day says so", () => {
    expect(glanceLine(dayGlance(view([], now), date, date, now), clock)).toBe("Today · Nothing planned");
  });
});

describe("spanLine", () => {
  const week = { first: "2026-10-19" as LocalDate, last: "2026-10-25" as LocalDate, noun: "week" as const, open: 5, due: 2 };

  it("counts the days left including today", () => {
    expect(spanLine(week, date)).toBe("This week · 3 days left · 5 open · 2 due");
    expect(spanLine(week, "2026-10-25" as LocalDate)).toBe("This week · Last day · 5 open · 2 due");
  });

  it("says where a span sits from today when it does not hold today", () => {
    expect(spanLine({ ...week, due: 0 }, "2026-10-12" as LocalDate)).toBe("Next week · 5 open");
    expect(spanLine({ ...week, open: 0, due: 0 }, "2026-10-26" as LocalDate)).toBe("Last week · Nothing open");
    expect(spanLine(week, "2026-11-02" as LocalDate)).toBe("2 weeks ago · 5 open · 2 due");
    expect(spanLine(week, "2026-10-05" as LocalDate)).toBe("In 2 weeks · 5 open · 2 due");
    const month = { first: "2026-11-01" as LocalDate, last: "2026-11-30" as LocalDate, noun: "month" as const, open: 1, due: 0 };
    expect(spanLine(month, date)).toBe("Next month · 1 open");
    expect(spanLine(month, "2027-01-04" as LocalDate)).toBe("2 months ago · 1 open");
  });
});
