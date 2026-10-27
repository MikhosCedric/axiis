import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate, VirtualItem } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { canDo, deleteKind, menuStep, moreEntries, placeNear, quickItem, quickNote, rowKeyAction, type RowPress } from "./model";

const TZ = "Europe/London";
const SERIES = "00000000-0000-4000-8000-00000000aaaa" as ItemId;

const press = (key: string, over: Partial<RowPress> = {}): RowPress => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  typing: false,
  defaultPrevented: false,
  sequence: false,
  ...over,
});

describe("quickItem", () => {
  it("reads a timed item's day and wall-clock time in the user's zone", () => {
    const item = makeItem({ schedule: { kind: "timed", start: new Date("2026-10-24T23:30:00Z"), end: new Date("2026-10-25T00:15:00Z") } });
    expect(quickItem(item, TZ)).toMatchObject({ day: "2026-10-25", time: { start: 30, length: 45 }, series: "none", occurrence: null });
  });

  it("names an occurrence not stored yet by its key, and an override by its stored id with the occurrence key beside it", () => {
    const virtual: VirtualItem = {
      ...makeItem({ schedule: { kind: "day", on: "2026-11-02" as LocalDate } }),
      id: `${SERIES}~2026-11-02` as VirtualItem["id"],
      recurrence: { kind: "occurrence", seriesId: SERIES, originalOn: "2026-11-02" as LocalDate },
    };
    expect(quickItem(virtual, TZ)).toMatchObject({ key: `${SERIES}~2026-11-02`, series: "occurrence", occurrence: `${SERIES}~2026-11-02` });
    const override = makeItem({ recurrence: { kind: "override", seriesId: SERIES, originalOn: "2026-11-03" as LocalDate } });
    expect(quickItem(override, TZ)).toMatchObject({ key: override.id, series: "occurrence", occurrence: `${SERIES}~2026-11-03`, day: "2026-11-03" });
  });

  it("marks a series' own row", () => {
    const series = makeItem({ recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } } as never });
    expect(quickItem(series, TZ).series).toBe("series");
  });
});

describe("what a row can do", () => {
  const task = quickItem(makeItem({ schedule: { kind: "day", on: "2026-11-02" as LocalDate } }), TZ);
  const note = quickNote({ id: "n", title: "Ideas" });

  it("gives a note no done box and no day", () => {
    expect(canDo(note, "done")).toBe(false);
    expect(canDo(note, "plan")).toBe(false);
    expect(canDo(note, "rename")).toBe(true);
    expect(moreEntries(note)).toEqual(["duplicate", "open"]);
  });

  it("does not plan a series' own row, which moves by its first day", () => {
    expect(canDo({ ...task, series: "series" }, "plan")).toBe(false);
  });

  it("offers a planned one-off the Inbox and an event, and an event a task", () => {
    expect(moreEntries(task)).toEqual(["duplicate", "make-event", "inbox", "open"]);
    expect(moreEntries({ ...task, type: "event" })).toEqual(["duplicate", "make-task", "inbox", "open"]);
    expect(moreEntries({ ...task, day: null })).toEqual(["duplicate", "make-event", "open"]);
  });

  it("never offers an occurrence the Inbox, and offers it Delete every time", () => {
    expect(moreEntries({ ...task, series: "occurrence" })).toEqual(["duplicate", "make-event", "delete-all", "open"]);
  });

  it("keeps a subtask a task", () => {
    expect(moreEntries({ ...task, subtask: true })).not.toContain("make-event");
  });

  it("deletes a one-off at once, and asks before anything that repeats", () => {
    expect(deleteKind(task)).toBe("now");
    expect(deleteKind({ ...task, series: "occurrence" })).toBe("ask-occurrence");
    expect(deleteKind({ ...task, series: "series" })).toBe("ask-series");
  });
});

describe("rowKeyAction", () => {
  it("maps the row keys", () => {
    expect(["e", "E", "p", "d", ".", "Delete", "Backspace"].map((k) => rowKeyAction(press(k)))).toEqual([
      "rename",
      "rename",
      "plan",
      "done",
      "more",
      "delete",
      "delete",
    ]);
    expect(rowKeyAction(press("ContextMenu"))).toBe("more");
    expect(rowKeyAction(press("F10", { shiftKey: true }))).toBe("more");
  });

  it("leaves Delete to the Score and the Week, where it sends an item to the Inbox", () => {
    expect(rowKeyAction(press("Delete"), false)).toBeNull();
  });

  it("ignores a key that is typing, held with a modifier, already handled, or part of G or A", () => {
    expect(rowKeyAction(press("e", { typing: true }))).toBeNull();
    expect(rowKeyAction(press("d", { ctrlKey: true }))).toBeNull();
    expect(rowKeyAction(press("d", { metaKey: true }))).toBeNull();
    expect(rowKeyAction(press("D", { shiftKey: true }))).toBeNull();
    expect(rowKeyAction(press("d", { defaultPrevented: true }))).toBeNull();
    expect(rowKeyAction(press("d", { sequence: true }))).toBeNull();
    expect(rowKeyAction(press("x"))).toBeNull();
  });
});

describe("menuStep", () => {
  const labels = ["Duplicate", "Make an event", "Move to the Inbox", "Open details"];

  it("wraps the arrows and goes to the ends", () => {
    expect(menuStep("ArrowDown", 3, labels)).toBe(0);
    expect(menuStep("ArrowUp", 0, labels)).toBe(3);
    expect(menuStep("Home", 2, labels)).toBe(0);
    expect(menuStep("End", 0, labels)).toBe(3);
  });

  it("jumps to the next entry starting with a letter, wrapping", () => {
    expect(menuStep("m", 0, labels)).toBe(1);
    expect(menuStep("m", 1, labels)).toBe(2);
    expect(menuStep("M", 2, labels)).toBe(1);
    expect(menuStep("z", 0, labels)).toBeNull();
    expect(menuStep("Enter", 0, labels)).toBeNull();
    expect(menuStep(" ", 0, labels)).toBeNull();
  });
});

describe("placeNear", () => {
  const view = { width: 400, height: 600 };
  const size = { width: 200, height: 150 };

  it("sits under its anchor, left edges lined up", () => {
    expect(placeNear({ left: 40, top: 100, width: 30, height: 20 }, size, view)).toEqual({ left: 40, top: 124 });
  });

  it("flips above when there is no room below, and stays inside the window", () => {
    expect(placeNear({ left: 300, top: 500, width: 30, height: 20 }, size, view)).toEqual({ left: 184, top: 346 });
  });

  it("holds the margin when the window is too short either way", () => {
    expect(placeNear({ left: 0, top: 60, width: 0, height: 0 }, { width: 200, height: 560 }, view)).toEqual({ left: 16, top: 24 });
  });
});
