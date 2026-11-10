import { describe, expect, it } from "vitest";
import { NEXT_UP_MAX } from "@/features/day/glance";
import { DEFAULT_MINUTES } from "@/features/score/drop";
import { CAPTURE_EXAMPLES } from "@/features/today/capture-syntax";
import {
  DRAG_AXIS,
  LANDING_DEFAULT_MINUTES,
  LANDING_NEXT_UP_MAX,
  focusSplit,
  foldedLine,
  keySpan,
  moveBy,
  placeCapture,
  resizeBy,
  type DayRow,
} from "./demo-model";

it("uses the app's own default length and Next up count", () => {
  expect(LANDING_DEFAULT_MINUTES).toBe(DEFAULT_MINUTES);
  expect(LANDING_NEXT_UP_MAX).toBe(NEXT_UP_MAX);
});

describe("placeCapture", () => {
  it("puts a line with a day and a time on that day's line, half an hour long unless a length was typed", () => {
    expect(placeCapture("dentist tomorrow 9am #health")).toEqual({
      kind: "timed",
      title: "dentist",
      day: "tomorrow",
      start: 9 * 60,
      end: 9 * 60 + 30,
      tags: ["health"],
      repeats: null,
    });
    expect(placeCapture(CAPTURE_EXAMPLES[1])).toEqual({
      kind: "timed",
      title: "call Sam",
      day: "Friday",
      start: 14 * 60,
      end: 14 * 60 + 30,
      tags: [],
      repeats: null,
    });
  });

  it("reads a time with no day as today", () => {
    expect(placeCapture("stand-up 9:30 for 15m")).toMatchObject({ kind: "timed", day: "today", start: 570, end: 585 });
  });

  it("puts a day with no time in Any time, and a bare line in the Inbox", () => {
    expect(placeCapture("call Sam next friday")).toEqual({ kind: "anytime", title: "call Sam", day: "next Friday", tags: [], repeats: null });
    expect(placeCapture(CAPTURE_EXAMPLES[2])).toEqual({ kind: "inbox", title: "buy milk", tags: [] });
    expect(placeCapture("Groceries for Sunday")).toEqual({ kind: "inbox", title: "Groceries for Sunday", tags: [] });
  });

  it("plans a repeat on the days it falls on, in the parser's words, with the sample week it marks", () => {
    expect(placeCapture(CAPTURE_EXAMPLES[3])).toEqual({
      kind: "timed",
      title: "gym",
      day: "Tuesdays",
      start: 7 * 60 + 30,
      end: 9 * 60,
      tags: [],
      repeats: { words: "every Tuesday", week: [1] },
    });
    expect(placeCapture("standup weekdays 9:00")).toMatchObject({ day: "Weekdays", repeats: { words: "every weekday", week: [0, 1, 2, 3, 4] } });
    expect(placeCapture("swim mon/wed/fri 7am")).toMatchObject({ day: "Mon, Wed, Fri", repeats: { week: [0, 2, 4] } });
    expect(placeCapture("pills every day")).toEqual({
      kind: "anytime",
      title: "pills",
      day: "Every day",
      tags: [],
      repeats: { words: "every day", week: [0, 1, 2, 3, 4, 5, 6] },
    });
    // A repeat that skips weeks is named whole, and marks no single week.
    expect(placeCapture("clean every 2nd tuesday")).toMatchObject({ kind: "anytime", day: "Every other Tuesday", repeats: { words: "every other Tuesday", week: [] } });
    expect(placeCapture("haircut every 3 months")).toMatchObject({ day: "Every 3 months", repeats: { week: [] } });
    expect(placeCapture("pills every day starting tomorrow 8am")).toMatchObject({ kind: "timed", day: "tomorrow", repeats: { words: "every day" } });
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
