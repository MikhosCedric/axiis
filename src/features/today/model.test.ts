import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { dayRangeFor } from "@/lib/dates";
import { buildToday, stateOf, summaryLine } from "./model";
import { makeItem } from "./test-support";

const range = dayRangeFor("2026-10-06" as LocalDate, "UTC");
const now = new Date("2026-10-06T10:40:00Z");
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 6, h, m));
const timed = (title: string, start: Date, end: Date, over = {}) =>
  makeItem({ title, schedule: { kind: "timed", start, end }, ...over });

describe("stateOf", () => {
  it("is live only while now is inside a timed item's span", () => {
    expect(stateOf(timed("a", at(10), at(11)), now)).toBe("live");
    expect(stateOf(timed("a", at(10, 40), at(11)), now)).toBe("live");
    expect(stateOf(timed("a", at(10), at(10, 40)), now)).toBe("planned");
    expect(stateOf(timed("a", at(12), at(13)), now)).toBe("planned");
  });

  it("is done whenever the item is done, even mid-span", () => {
    expect(stateOf(timed("a", at(10), at(11), { status: "done" }), now)).toBe("done");
  });

  it("never makes a day-only or unscheduled item live", () => {
    expect(stateOf(makeItem({ schedule: { kind: "day", on: range.date } }), now)).toBe("planned");
    expect(stateOf(makeItem(), now)).toBe("planned");
  });
});

describe("buildToday", () => {
  it("orders day-only items first, then timed items by start", () => {
    const view = buildToday(
      {
        scheduled: [
          timed("Lunch", at(12), at(13)),
          makeItem({ title: "Any time B", position: 2, schedule: { kind: "day", on: range.date } }),
          timed("Run", at(7), at(7, 45)),
          makeItem({ title: "Any time A", position: 1, schedule: { kind: "day", on: range.date } }),
          timed("Brief", at(10), at(11, 30)),
        ],
        unscheduled: [],
      },
      range,
      now,
    );
    expect(view.scheduled.map((e) => e.item.title)).toEqual(["Any time A", "Any time B", "Run", "Brief", "Lunch"]);
    expect(view.scheduled.map((e) => e.state)).toEqual(["planned", "planned", "planned", "live", "planned"]);
  });

  it("drops notes and dropped items from both lists", () => {
    const view = buildToday(
      {
        scheduled: [timed("Dropped", at(9), at(10), { status: "dropped" })],
        unscheduled: [makeItem({ type: "note", title: "Note" }), makeItem({ title: "Gone", status: "dropped" })],
      },
      range,
      now,
    );
    expect(view).toEqual({ scheduled: [], waiting: [] });
  });

  it("keeps a waiting item finished today but hides older finished ones", () => {
    const view = buildToday(
      {
        scheduled: [],
        unscheduled: [
          makeItem({ title: "Open" }),
          makeItem({ title: "Done today", status: "done", completedAt: at(9) }),
          makeItem({ title: "Done yesterday", status: "done", completedAt: new Date("2026-10-05T23:59:59Z") }),
        ],
      },
      range,
      now,
    );
    expect(view.waiting.map((e) => [e.item.title, e.state])).toEqual([
      ["Open", "planned"],
      ["Done today", "done"],
    ]);
  });

  it("puts the newest capture at the top of the waiting list", () => {
    const view = buildToday(
      {
        scheduled: [],
        unscheduled: [
          makeItem({ title: "Older", createdAt: at(8) }),
          makeItem({ title: "Newest", createdAt: at(10) }),
          makeItem({ title: "Middle", createdAt: at(9) }),
        ],
      },
      range,
      now,
    );
    expect(view.waiting.map((e) => e.item.title)).toEqual(["Newest", "Middle", "Older"]);
  });
});

describe("summaryLine", () => {
  const view = (scheduled: ReturnType<typeof makeItem>[], unscheduled: ReturnType<typeof makeItem>[] = []) =>
    buildToday({ scheduled, unscheduled }, range, now);

  it("says so plainly when the day is empty", () => {
    expect(summaryLine(view([]))).toBe("Nothing planned yet.");
  });

  it("counts open and done items, then what is waiting", () => {
    const v = view(
      [timed("a", at(8), at(9), { status: "done" }), timed("b", at(12), at(13)), timed("c", at(14), at(15))],
      [makeItem(), makeItem({ status: "done", completedAt: at(9) })],
    );
    expect(summaryLine(v)).toBe("2 open, 1 done today. 1 waiting.");
  });

  it("leaves out the done count when nothing is done", () => {
    expect(summaryLine(view([timed("a", at(12), at(13))]))).toBe("1 open today.");
  });

  it("notes a finished day without fuss", () => {
    expect(summaryLine(view([timed("a", at(8), at(9), { status: "done" })]))).toBe(
      "Everything planned for today is done.",
    );
  });

  it("does not say today about another day", () => {
    expect(summaryLine(view([timed("a", at(12), at(13))]), false)).toBe("1 open.");
    expect(summaryLine(view([timed("a", at(8), at(9), { status: "done" })]), false)).toBe(
      "Everything planned for this day is done.",
    );
    expect(summaryLine(view([], [makeItem()]), false)).toBe("Nothing has a time on this day. 1 waiting.");
  });

  it("mentions waiting items when nothing has a time", () => {
    expect(summaryLine(view([], [makeItem(), makeItem()]))).toBe("Nothing has a time today. 2 waiting.");
  });
});
