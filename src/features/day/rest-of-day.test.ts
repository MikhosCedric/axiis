import { describe, expect, it } from "vitest";
import type { Item, LocalDate, ShownItem } from "@/domain/item";
import { buildToday } from "@/features/today/model";
import { makeItem } from "@/features/today/test-support";
import { dayRangeFor } from "@/lib/dates";
import { restNews, restOfDay } from "./rest-of-day";

const date = "2026-10-23" as LocalDate;
const at = (hh: number) => new Date(`${date}T${String(hh).padStart(2, "0")}:00:00Z`);
const timed = (title: string, from: number, to: number, over: Partial<Item> = {}) =>
  makeItem({ title, schedule: { kind: "timed", start: at(from), end: at(to) }, ...over });
const anyTime = (title: string, over: Partial<Item> = {}) => makeItem({ title, schedule: { kind: "day", on: date }, ...over });
const view = (items: ShownItem[], now: Date) => buildToday({ scheduled: items, unscheduled: [] }, dayRangeFor(date, "UTC"), now);

describe("restOfDay", () => {
  it("holds the open tasks and checklists planned for the day, and not what is done, live, an event or a series", () => {
    const rest = restOfDay(
      view(
        [
          timed("Run", 7, 8, { status: "done", completedAt: at(8) }),
          timed("Focus block", 14, 15),
          timed("Call the plumber", 18, 19),
          timed("Design sync", 16, 17, { type: "event" }),
          timed("Missed the dentist", 9, 10),
          anyTime("Groceries", { type: "checklist" }),
          anyTime("Send the invoice"),
          anyTime("Water the plants", { recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } } as Item["recurrence"] }),
        ],
        new Date(`${date}T14:20:00Z`),
      ).scheduled,
    );
    expect(rest.map((r) => r.title).sort()).toEqual(["Call the plumber", "Groceries", "Missed the dentist", "Send the invoice"]);
  });

  it("is empty when nothing is left", () => {
    expect(restOfDay(view([anyTime("Done already", { status: "done", completedAt: at(8) })], at(12)).scheduled)).toEqual([]);
  });
});

describe("restNews", () => {
  it("counts plainly", () => {
    expect(restNews(1, 0)).toBe("1 thing is planned for tomorrow.");
    expect(restNews(3, 0)).toBe("3 things are planned for tomorrow.");
    expect(restNews(3, 1)).toBe("3 things are planned for tomorrow. 1 did not save. Try again.");
    expect(restNews(0, 2)).toBe("That did not save. Try again.");
  });
});
