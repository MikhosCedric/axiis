import { describe, expect, it } from "vitest";
import type { Item, LocalDate } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import {
  bucketWeek,
  dayOf,
  formatWeekHeading,
  keyDestination,
  moves,
  moveTo,
  moveToDay,
  readDropZone,
  weekHref,
  weekNavTarget,
  weekOf,
  weekRange,
  weekSummary,
  weekTitle,
} from "./model";

const d = (s: string) => s as LocalDate;
const at = (iso: string) => new Date(iso);
const timed = (start: string, end: string, over: Partial<Item> = {}) =>
  makeItem({ schedule: { kind: "timed", start: at(start), end: at(end) }, ...over });
const onDay = (on: string, over: Partial<Item> = {}) => makeItem({ schedule: { kind: "day", on: d(on) }, ...over });
const HOUR = 3_600_000;

describe("weekOf", () => {
  it("runs Monday to Sunday from any day inside it", () => {
    const week = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
    for (const day of week) expect(weekOf(d(day))).toEqual(week);
  });

  it("crosses a month and a year boundary by calendar date", () => {
    expect(weekOf(d("2026-10-01"))).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weekOf(d("2026-01-01"))[0]).toBe("2025-12-29");
    expect(weekOf(d("2026-01-01"))[6]).toBe("2026-01-04");
    expect(weekOf(d("2028-02-29"))).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
      "2028-03-02",
      "2028-03-03",
      "2028-03-04",
      "2028-03-05",
    ]);
  });
});

describe("weekRange", () => {
  it("covers the seven local days, half-open", () => {
    expect(weekRange(weekOf(d("2026-10-06")), "UTC")).toEqual({
      from: at("2026-10-05T00:00:00Z"),
      to: at("2026-10-12T00:00:00Z"),
      fromDate: "2026-10-05",
      toDate: "2026-10-12",
    });
  });

  it("is an hour short in the week clocks go forward and an hour long when they go back", () => {
    const spring = weekRange(weekOf(d("2026-03-04")), "America/New_York");
    expect(spring.from).toEqual(at("2026-03-02T05:00:00Z"));
    expect(spring.to).toEqual(at("2026-03-09T04:00:00Z"));
    expect(spring.to.getTime() - spring.from.getTime()).toBe(167 * HOUR);

    const autumn = weekRange(weekOf(d("2026-10-21")), "Europe/London");
    expect(autumn.from).toEqual(at("2026-10-18T23:00:00Z"));
    expect(autumn.to).toEqual(at("2026-10-26T00:00:00Z"));
    expect(autumn.to.getTime() - autumn.from.getTime()).toBe(169 * HOUR);
  });

  it("spans the new year", () => {
    const r = weekRange(weekOf(d("2025-12-31")), "Asia/Kolkata");
    expect(r.fromDate).toBe("2025-12-29");
    expect(r.toDate).toBe("2026-01-05");
    expect(r.from).toEqual(at("2025-12-28T18:30:00Z"));
    expect(r.to).toEqual(at("2026-01-04T18:30:00Z"));
  });
});

describe("dayOf", () => {
  it("reads a timed item's local start date, a day-only item's date, and nothing for waiting items", () => {
    expect(dayOf(timed("2026-10-07T20:00:00Z", "2026-10-07T21:00:00Z"), "Asia/Kolkata")).toBe("2026-10-08");
    expect(dayOf(timed("2026-10-07T20:00:00Z", "2026-10-07T21:00:00Z"), "UTC")).toBe("2026-10-07");
    expect(dayOf(onDay("2026-10-09"), "Asia/Kolkata")).toBe("2026-10-09");
    expect(dayOf(makeItem(), "UTC")).toBeNull();
  });
});

describe("bucketWeek", () => {
  const days = weekOf(d("2026-10-06"));
  const now = at("2026-10-06T09:30:00Z");

  it("puts each item on its local day, any time first and then by start", () => {
    const ten = timed("2026-10-06T10:00:00Z", "2026-10-06T11:00:00Z", { title: "ten" });
    const eight = timed("2026-10-06T08:00:00Z", "2026-10-06T08:30:00Z", { title: "eight" });
    const second = onDay("2026-10-06", { title: "second", position: 1 });
    const first = onDay("2026-10-06", { title: "first", position: 0 });
    const sunday = onDay("2026-10-11", { title: "sunday" });

    const week = bucketWeek([ten, eight, second, sunday, first], days, "UTC", now);

    expect(week.map((w) => w.date)).toEqual(days);
    expect(week[1].entries.map((e) => e.item.title)).toEqual(["first", "second", "eight", "ten"]);
    expect(week[6].entries.map((e) => e.item.title)).toEqual(["sunday"]);
    expect(week.filter((_, i) => i !== 1 && i !== 6).every((w) => w.entries.length === 0)).toBe(true);
  });

  it("uses the user's zone, so a late UTC evening lands on the next local day", () => {
    // 19:00 UTC on Tuesday is 00:30 on Wednesday in Kolkata.
    const item = timed("2026-10-06T19:00:00Z", "2026-10-06T20:00:00Z");
    const week = bucketWeek([item], days, "Asia/Kolkata", now);
    expect(week[1].entries).toEqual([]);
    expect(week[2].entries.map((e) => e.item.id)).toEqual([item.id]);
  });

  it("marks state and leaves out dropped items and anything outside the week", () => {
    const live = timed("2026-10-06T09:00:00Z", "2026-10-06T10:00:00Z");
    const done = onDay("2026-10-07", { status: "done", completedAt: now });
    const dropped = onDay("2026-10-07", { status: "dropped" });
    const nextWeek = onDay("2026-10-12");
    const week = bucketWeek([live, done, dropped, nextWeek], days, "UTC", now);
    expect(week[1].entries).toEqual([{ item: live, state: "live" }]);
    expect(week[2].entries).toEqual([{ item: done, state: "done" }]);
    expect(week.flatMap((w) => w.entries)).toHaveLength(2);
  });
});

describe("moveToDay", () => {
  it("keeps a timed item's clock and length on the new day", () => {
    const item = timed("2026-10-06T09:00:00Z", "2026-10-06T10:30:00Z");
    expect(moveToDay(item, d("2026-10-08"), "UTC")).toEqual({
      schedule: { kind: "timed", start: at("2026-10-08T09:00:00Z"), end: at("2026-10-08T10:30:00Z") },
    });
  });

  it("keeps local wall-clock time when the move crosses a clock change", () => {
    // 09:00 to 10:30 in London: BST on Friday 23 October, GMT on Sunday 25 October.
    const london = timed("2026-10-23T08:00:00Z", "2026-10-23T09:30:00Z");
    expect(moveToDay(london, d("2026-10-25"), "Europe/London")).toEqual({
      schedule: { kind: "timed", start: at("2026-10-25T09:00:00Z"), end: at("2026-10-25T10:30:00Z") },
    });
    // 09:00 to 10:30 in New York: EST on Friday 6 March, EDT on Sunday 8 March.
    const newYork = timed("2026-03-06T14:00:00Z", "2026-03-06T15:30:00Z");
    expect(moveToDay(newYork, d("2026-03-08"), "America/New_York")).toEqual({
      schedule: { kind: "timed", start: at("2026-03-08T13:00:00Z"), end: at("2026-03-08T14:30:00Z") },
    });
  });

  it("keeps the wall-clock length, not the elapsed length, on the night clocks change", () => {
    // 00:30 to 03:30 local is three hours on the 24th and four elapsed hours on the 25th.
    const late = timed("2026-10-23T23:30:00Z", "2026-10-24T02:30:00Z");
    expect(moveToDay(late, d("2026-10-25"), "Europe/London")).toEqual({
      schedule: { kind: "timed", start: at("2026-10-24T23:30:00Z"), end: at("2026-10-25T03:30:00Z") },
    });
  });

  it("carries an item that runs past midnight", () => {
    const item = timed("2026-10-06T23:00:00Z", "2026-10-07T01:00:00Z");
    expect(moveToDay(item, d("2026-10-11"), "UTC")).toEqual({
      schedule: { kind: "timed", start: at("2026-10-11T23:00:00Z"), end: at("2026-10-12T01:00:00Z") },
    });
  });

  it("keeps a day-only item day-only and gives a waiting item the day", () => {
    expect(moveToDay(onDay("2026-10-06"), d("2026-10-09"), "UTC")).toEqual({ schedule: { kind: "day", on: "2026-10-09" } });
    expect(moveToDay(makeItem(), d("2026-10-09"), "UTC")).toEqual({ schedule: { kind: "day", on: "2026-10-09" } });
  });
});

describe("moveTo and moves", () => {
  it("clears the schedule for the tray", () => {
    expect(moveTo(onDay("2026-10-06"), "tray", "UTC")).toEqual({ schedule: { kind: "unscheduled" } });
  });

  it("knows a drop on the item's own day or a waiting item on the tray changes nothing", () => {
    const tue = timed("2026-10-06T09:00:00Z", "2026-10-06T10:00:00Z");
    expect(moves(tue, d("2026-10-06"), "UTC")).toBe(false);
    expect(moves(tue, d("2026-10-07"), "UTC")).toBe(true);
    expect(moves(tue, "tray", "UTC")).toBe(true);
    expect(moves(makeItem(), "tray", "UTC")).toBe(false);
    expect(moves(makeItem(), d("2026-10-06"), "UTC")).toBe(true);
  });
});

describe("keyDestination", () => {
  const days = weekOf(d("2026-10-06"));
  const today = d("2026-10-07");

  it("steps a planned item a day either way inside the week", () => {
    const wed = onDay("2026-10-07");
    expect(keyDestination(wed, days, today, "UTC", "ArrowLeft")).toBe("2026-10-06");
    expect(keyDestination(wed, days, today, "UTC", "ArrowRight")).toBe("2026-10-08");
    expect(keyDestination(onDay("2026-10-05"), days, today, "UTC", "ArrowLeft")).toBeNull();
    expect(keyDestination(onDay("2026-10-11"), days, today, "UTC", "ArrowRight")).toBeNull();
  });

  it("sends a planned item back to the tray with Backspace or Delete", () => {
    const wed = timed("2026-10-07T09:00:00Z", "2026-10-07T10:00:00Z");
    expect(keyDestination(wed, days, today, "UTC", "Backspace")).toBe("tray");
    expect(keyDestination(wed, days, today, "UTC", "Delete")).toBe("tray");
  });

  it("gives a waiting item today, or the first day when today is in another week", () => {
    expect(keyDestination(makeItem(), days, today, "UTC", "ArrowUp")).toBe("2026-10-07");
    expect(keyDestination(makeItem(), days, d("2026-11-02"), "UTC", "ArrowUp")).toBe("2026-10-05");
    expect(keyDestination(makeItem(), days, today, "UTC", "ArrowLeft")).toBeNull();
    expect(keyDestination(makeItem(), days, today, "UTC", "Backspace")).toBeNull();
  });

  it("ignores other keys", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "x"]) {
      expect(keyDestination(onDay("2026-10-07"), days, today, "UTC", key)).toBeNull();
    }
  });
});

describe("readDropZone", () => {
  const days = weekOf(d("2026-10-06"));
  it("accepts the tray and the week's own days only", () => {
    expect(readDropZone("tray", days)).toBe("tray");
    expect(readDropZone("2026-10-08", days)).toBe("2026-10-08");
    for (const raw of [undefined, "", "2026-10-12", "2026-13-01", "Tray"]) expect(readDropZone(raw, days)).toBeNull();
  });
});

describe("weekSummary", () => {
  const days = weekOf(d("2026-10-06"));
  const now = at("2026-10-06T08:00:00Z");
  const entry = (item: Item) => ({ item, state: item.status === "done" ? ("done" as const) : ("planned" as const) });

  it("says where the week stands: days left, open, due in it and the open Inbox", () => {
    const week = bucketWeek(
      [
        onDay("2026-10-05"),
        onDay("2026-10-08", { dueOn: d("2026-10-09") }),
        onDay("2026-10-11", { status: "done", completedAt: now }),
      ],
      days,
      "UTC",
      now,
    );
    const inbox = [entry(makeItem({ dueOn: d("2026-10-10") })), entry(makeItem({ dueOn: d("2026-10-20") })), entry(makeItem({ status: "done" }))];
    expect(weekSummary(week, inbox, d("2026-10-06"))).toBe("This week · 6 days left · 2 open · 2 due · 2 in the Inbox");
    expect(weekSummary(week, [], d("2026-10-11"))).toBe("This week · Last day · 2 open · 1 due");
    expect(weekSummary(bucketWeek([], days, "UTC", now), [], d("2026-10-14"))).toBe("Last week · Nothing open");
  });
});

describe("headings and links", () => {
  it("names the week compactly, adding months and years only when they change", () => {
    expect(formatWeekHeading(weekOf(d("2026-10-06")))).toBe("5 to 11 October");
    expect(formatWeekHeading(weekOf(d("2026-10-01")))).toBe("28 September to 4 October");
    expect(formatWeekHeading(weekOf(d("2026-01-01")))).toBe("29 December 2025 to 4 January 2026");
    expect(weekTitle(weekOf(d("2026-01-01")))).toBe("Week of 29 December 2025");
  });

  it("links the current week as /week and any other by its first day", () => {
    const today = d("2026-10-06");
    expect(weekHref(d("2026-10-11"), today)).toBe("/week");
    expect(weekHref(d("2026-10-14"), today)).toBe("/week/2026-10-12");
    expect(weekHref(d("2026-10-04"), today)).toBe("/week/2026-09-28");
  });

  it("steps whole weeks, or jumps back to today", () => {
    const today = d("2026-10-06");
    expect(weekNavTarget("previous", d("2026-10-08"), today)).toBe("2026-09-28");
    expect(weekNavTarget("next", d("2026-10-08"), today)).toBe("2026-10-12");
    expect(weekNavTarget("next", d("2025-12-31"), today)).toBe("2026-01-05");
    expect(weekNavTarget("today", d("2025-12-31"), today)).toBe("2026-10-06");
  });
});
