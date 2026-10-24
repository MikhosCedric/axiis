import { describe, expect, it } from "vitest";
import { CAPTURE_EXAMPLES } from "@/features/today/capture-syntax";
import { DRAG_AXIS, focusSplit, foldedLine, keySpan, moveBy, placeCapture, resizeBy, type DayRow } from "./demo-model";

describe("placeCapture", () => {
  it("puts a line with a day and a time on that day's line, half an hour long unless a length was typed", () => {
    expect(placeCapture("dentist tomorrow 9am #health")).toEqual({
      kind: "timed",
      title: "dentist",
      day: "Tomorrow",
      start: 9 * 60,
      end: 9 * 60 + 30,
      tags: ["health"],
    });
    expect(placeCapture(CAPTURE_EXAMPLES[1])).toEqual({
      kind: "timed",
      title: "call Sam",
      day: "Friday",
      start: 14 * 60,
      end: 14 * 60 + 30,
      tags: [],
    });
  });

  it("reads a time with no day as today", () => {
    expect(placeCapture("stand-up 9:30 for 15m")).toMatchObject({ kind: "timed", day: "Today", start: 570, end: 585 });
  });

  it("puts a day with no time in Any time, and a bare line in the Inbox", () => {
    expect(placeCapture("call Sam next friday")).toEqual({ kind: "anytime", title: "call Sam", day: "Next Friday", tags: [] });
    expect(placeCapture(CAPTURE_EXAMPLES[2])).toEqual({ kind: "inbox", title: "buy milk", tags: [] });
    expect(placeCapture("Groceries for Sunday")).toEqual({ kind: "inbox", title: "Groceries for Sunday", tags: [] });
  });

  it("lands nothing for an empty line", () => {
    expect(placeCapture("   ")).toEqual({ kind: "nothing" });
  });
});

describe("the drag demo's beam", () => {
  const beam = { start: 14 * 60, end: 15 * 60 + 30 };

  it("moves on the quarter hour and stays on the staff", () => {
    expect(moveBy(beam, 22)).toEqual({ start: 14 * 60 + 15, end: 15 * 60 + 45 });
    expect(moveBy(beam, -24 * 60)).toEqual({ start: DRAG_AXIS.start, end: DRAG_AXIS.start + 90 });
    expect(moveBy(beam, 24 * 60)).toEqual({ start: DRAG_AXIS.end - 90, end: DRAG_AXIS.end });
  });

  it("changes its end without going under a quarter hour", () => {
    expect(resizeBy(beam, 30)).toEqual({ start: beam.start, end: 16 * 60 });
    expect(resizeBy(beam, -600)).toEqual({ start: beam.start, end: beam.start + 15 });
  });

  it("answers the Score's keys: arrows move, Shift and an arrow change the end, others do nothing", () => {
    expect(keySpan(beam, "ArrowRight", false)).toEqual({ start: 14 * 60 + 15, end: 15 * 60 + 45 });
    expect(keySpan(beam, "ArrowLeft", true)).toEqual({ start: 14 * 60, end: 15 * 60 + 15 });
    expect(keySpan(beam, "ArrowUp", false)).toBeNull();
  });
});

describe("focusSplit", () => {
  const row = (id: string, start: number, end: number, done = false): DayRow => ({ id, title: id, start, end, done });
  const day = [
    row("run", 420, 465, true),
    row("summary", 510, 600, true),
    row("review", 630, 720),
    row("landlord", 750, 765),
    row("physio", 780, 810),
    row("plan", 840, 930),
    row("venue", 960, 990),
    row("groceries", 1050, 1095),
  ];

  it("keeps what is happening and the next three, and counts the rest", () => {
    const split = focusSplit(day, 680);
    expect(split.kept.map((r) => r.id)).toEqual(["review", "landlord", "physio", "plan"]);
    expect(split).toMatchObject({ planned: 2, done: 2 });
    expect(foldedLine(split)).toBe("2 more planned · 2 done");
  });

  it("says nothing else is folded when nothing is", () => {
    expect(foldedLine({ planned: 0, done: 0 })).toBe("Nothing else");
  });
});
