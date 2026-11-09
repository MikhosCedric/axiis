import { describe, expect, it } from "vitest";
import type { ShownItem } from "@/domain/item";
import { buildToday } from "@/features/today/model";
import { dayRangeFor } from "@/lib/dates";
import { reminderRows } from "./reminders";

const today = "2026-11-09" as never;
const now = new Date("2026-11-09T10:00:00Z");
const range = dayRangeFor(today, "UTC");

function item(title: string, over: Record<string, unknown> = {}): ShownItem {
  return {
    id: title,
    title,
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
  } as unknown as ShownItem;
}
const timed = (title: string, hour: number, over: Record<string, unknown> = {}) =>
  item(title, { schedule: { kind: "timed", start: new Date(`2026-11-09T${String(hour).padStart(2, "0")}:00:00Z`), end: new Date(`2026-11-09T${String(hour + 1).padStart(2, "0")}:00:00Z`) }, ...over });
const view = (...scheduled: ShownItem[]) => buildToday({ scheduled, unscheduled: [] }, range, now);

describe("reminder rows", () => {
  it("lists what is still to start, soonest first, with the start as an instant", () => {
    const rows = reminderRows(view(timed("Late", 16), timed("Early", 11)), now);
    expect(rows).toEqual([
      { id: "Early", at: new Date("2026-11-09T11:00:00Z").getTime(), title: "Early" },
      { id: "Late", at: new Date("2026-11-09T16:00:00Z").getTime(), title: "Late" },
    ]);
  });

  it("leaves out what has started, is done, has no time, or is not planned", () => {
    const rows = reminderRows(
      view(timed("Started", 9), timed("Done", 12, { status: "done", completedAt: now }), item("Any time"), timed("Ahead", 13)),
      now,
    );
    expect(rows.map((r) => r.title)).toEqual(["Ahead"]);
  });

  it("keeps long titles short and the list to its limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => timed(`T${i}`, 11 + (i % 12)));
    expect(reminderRows(view(...many), now)).toHaveLength(20);
    expect(reminderRows(view(timed("x".repeat(200), 12)), now)[0].title).toHaveLength(80);
  });
});
