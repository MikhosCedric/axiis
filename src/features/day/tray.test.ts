import { describe, expect, it } from "vitest";
import type { ShownItem } from "@/domain/item";
import { buildToday } from "@/features/today/model";
import { dayRangeFor } from "@/lib/dates";
import { trayRows } from "./tray";

const zone = "UTC";
const today = "2026-11-09" as never;
const now = new Date("2026-11-09T10:00:00Z");
const range = dayRangeFor(today, zone);

function item(over: Partial<ShownItem> & { title: string }): ShownItem {
  return {
    id: over.title as never,
    type: "task",
    status: "open",
    areaId: null,
    dueOn: null,
    position: 0,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    completedAt: null,
    schedule: { kind: "day", date: today },
    recurrence: { kind: "none" },
    ...over,
  } as ShownItem;
}

const timed = (title: string, hour: number) =>
  item({ title, schedule: { kind: "timed", start: new Date(`2026-11-09T${hour}:00:00Z`), end: new Date(`2026-11-09T${hour + 1}:00:00Z`) } as never });

describe("the tray list", () => {
  it("says nothing on a day with nothing planned", () => {
    const view = buildToday({ scheduled: [], unscheduled: [] }, range, now);
    expect(trayRows(view, today, now, zone, "24")).toEqual([]);
  });

  it("gives the day in a line, then what is next with its time", () => {
    const view = buildToday({ scheduled: [timed("Design sync", 16), timed("Standup", 11), item({ title: "Pay rent" })], unscheduled: [] }, range, now);
    expect(trayRows(view, today, now, zone, "24")).toEqual(["Today · 0 of 3 done", "11:00  Standup", "16:00  Design sync", "Pay rent"]);
  });

  it("keeps long titles to one short line and stops at four rows", () => {
    const long = "x".repeat(80);
    const view = buildToday({ scheduled: [item({ title: long }), item({ title: "b" }), item({ title: "c" }), item({ title: "d" })], unscheduled: [] }, range, now);
    const rows = trayRows(view, today, now, zone, "24");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveLength(48);
    expect(rows[1].endsWith("…")).toBe(true);
  });
});
