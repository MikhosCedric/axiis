import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { MonthMark } from "@/features/month/model";
import type { Clock } from "@/lib/clock";
import { beamWords, chipWords, monthMarkName, weekWords } from "./item-name";

const today = "2026-10-23" as LocalDate;
const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00Z`);
const NBSP = " ";

/** axe's label-content-name-mismatch: the drawn words, punctuation dropped, appear in the name as one unbroken run. */
function words(text: string) {
  return text.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
}
function holdsLabel(name: string, drawn: string) {
  const [n, d] = [words(name), words(drawn)];
  return n.some((_, i) => d.every((w, j) => n[i + j] === w));
}

const common = { state: "planned" as const, repeats: false, dueOn: null, today, tags: [] as string[] };
const beam = (clock: Clock, over = {}) =>
  beamWords({
    ...common,
    title: "Write the launch brief",
    event: false,
    start: at("10:00"),
    end: at("11:30"),
    timeZone: "UTC",
    clock,
    resizing: false,
    over: false,
    area: "Work",
    count: undefined,
    ...over,
  });

describe("beamWords", () => {
  it("starts the name with what the beam draws, on either clock", () => {
    const twelve = beam("12", { count: { done: 2, total: 5 }, dueOn: today, tags: ["launch"] });
    expect(twelve.time).toBe(`10:00${NBSP}AM`);
    expect(twelve.name).toBe(`Write the launch brief, 2/5, 10:00${NBSP}AM, Due today, ends 11:30${NBSP}AM, Work, planned, 2 of 5 subtasks done, tagged launch`);
    expect(holdsLabel(twelve.name, `Write the launch brief 2/5 ${twelve.time} Due today`)).toBe(true);

    const day = beam("24", { count: { done: 2, total: 5 }, dueOn: today });
    expect(day.name.startsWith("Write the launch brief, 2/5, 10:00, Due today, ends 11:30")).toBe(true);
  });

  it("says an event's whole time as drawn, and a passed one without a state word", () => {
    const event = beam("24", { title: "Design sync", event: true, over: true, state: "planned" });
    expect(event.time).toBe("10:00–11:30");
    expect(event.name).toBe("Design sync, 10:00–11:30, passed, event, Work");
    expect(holdsLabel(event.name, "Design sync 10:00–11:30 passed")).toBe(true);
  });

  it("names both ends while it is resized", () => {
    const r = beam("12", { resizing: true });
    expect(r.time).toBe(`10:00${NBSP}AM to 11:30${NBSP}AM`);
    expect(r.name).toBe(`Write the launch brief, 10:00${NBSP}AM to 11:30${NBSP}AM, Work, planned`);
  });
});

describe("chipWords", () => {
  it("starts with the title, count, due mark and the tags as drawn, then where it sits", () => {
    const c = chipWords({ ...common, title: "Pay the bill", where: "any time, Home", count: { done: 1, total: 3 }, dueOn: "2026-10-01" as LocalDate, tags: ["bills", "home", "money"] });
    expect(c.name).toBe("Pay the bill, 1/3, Past due, #bills #home +1, any time, Home, planned, 1 of 3 subtasks done, tagged bills, home and money");
    expect(holdsLabel(c.name, "Pay the bill 1/3 Past due #bills #home +1")).toBe(true);
  });
});

describe("weekWords", () => {
  const week = (clock: Clock, over = {}) =>
    weekWords({
      ...common,
      variant: "row",
      title: "Stand-up",
      event: false,
      schedule: { kind: "timed", start: at("09:30"), end: at("09:45") },
      timeZone: "UTC",
      clock,
      area: "Work",
      ...over,
    });

  it("follows a row's line: title, time, due mark, area, tags", () => {
    const twelve = week("12", { dueOn: today, tags: ["team"], repeats: true });
    expect(twelve.name).toBe(`Stand-up, 9:30${NBSP}AM, Due today, Work, #team, ends 9:45${NBSP}AM, planned, repeats, tagged team`);
    expect(holdsLabel(twelve.name, `Stand-up 9:30${NBSP}AM Due today Work #team`)).toBe(true);
    expect(week("24").name).toBe("Stand-up, 09:30, Work, ends 09:45, planned");
    expect(week("24", { event: true }).name).toBe("Stand-up, 09:30–09:45, Work, planned");
  });

  it("says Any time as drawn, and what a phone's title-only chip leaves out after its title", () => {
    expect(week("24", { schedule: { kind: "day" }, state: "done" }).name).toBe("Stand-up, Any time, Work, done");
    const chip = week("12", { variant: "chip", dueOn: today });
    expect(chip.name).toBe(`Stand-up, 9:30${NBSP}AM to 9:45${NBSP}AM, Work, planned, Due today`);
  });
});

describe("monthMarkName", () => {
  const mark = (over: Partial<MonthMark>): MonthMark => ({
    key: "k",
    occurrence: null,
    title: "Standup",
    type: "task",
    state: "planned",
    time: null,
    area: "Work",
    areaColor: null,
    repeats: false,
    due: false,
    movable: true,
    ...over,
  });

  it("puts the time and due word first, as a day draws them", () => {
    expect(monthMarkName(mark({ time: `9:30${NBSP}AM`, repeats: true }), "cell")).toBe(`9:30${NBSP}AM, Standup, Work, planned, repeats`);
    expect(monthMarkName(mark({ time: "09:30", due: true }), "cell")).toBe("09:30, due, Standup, Work, planned");
    expect(holdsLabel(monthMarkName(mark({ time: "09:30", due: true }), "cell"), "09:30 · due Standup")).toBe(true);
    expect(monthMarkName(mark({ due: true, title: "File the report" }), "cell")).toBe("Due, File the report, Work, planned");
    expect(monthMarkName(mark({}), "row")).toBe("Standup, Work, any time, planned");
    expect(monthMarkName(mark({ time: "to 01:00" }), "row")).toBe("to 01:00, Standup, Work, continues from the day before, planned");
  });
});
