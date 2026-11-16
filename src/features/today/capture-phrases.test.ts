import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { TagName } from "@/domain/tag";
import type { Clock } from "@/lib/clock";
import type { WeekStart } from "@/features/week/week-of";
import { dayOf, momentAt, parseCapture, previewWords, soonAt, type CaptureArea, type DayWord } from "./capture-syntax";

const d = (s: string) => s as LocalDate;
const clock24: Clock = "24";
const say = (text: string, today: string, weekStart?: WeekStart, areas?: readonly CaptureArea[]) =>
  previewWords(parseCapture(text, { weekStart, areas }), clock24, { today: d(today) });

/** Reads a line and pins its day to a date, as the server does. */
function landsOn(text: string, today: string, weekStart?: WeekStart): { title: string; on: string | null; start: number | null; length: number | null } {
  const c = parseCapture(text, { weekStart });
  return { title: c.title, on: c.day ? dayOf(c.day, d(today), c.weekStart) : null, start: c.time?.start ?? null, length: c.time?.length ?? null };
}

// 2026-11-18 is a Wednesday.
const WED = "2026-11-18";

describe("relative days", () => {
  it.each<[string, string, WeekStart | undefined, string, string]>([
    ["plan next week", WED, undefined, "plan", "2026-11-23"],
    ["plan next week", WED, 0, "plan", "2026-11-22"],
    ["plan next week", "2026-11-22", undefined, "plan", "2026-11-23"],
    ["plan next week", "2026-11-22", 0, "plan", "2026-11-29"],
    ["plan this weekend", WED, undefined, "plan", "2026-11-21"],
    ["plan this weekend", "2026-11-21", undefined, "plan", "2026-11-21"],
    ["plan this weekend", "2026-11-22", undefined, "plan", "2026-11-22"],
    ["plan next weekend", WED, undefined, "plan", "2026-11-28"],
    ["plan next weekend", "2026-11-22", undefined, "plan", "2026-11-28"],
    ["plan tonight", WED, undefined, "plan", WED],
    ["plan next month", WED, undefined, "plan", "2026-12-01"],
    ["plan next month", "2026-12-15", undefined, "plan", "2027-01-01"],
    ["plan end of month", WED, undefined, "plan", "2026-11-30"],
    ["plan end of month", "2028-02-10", undefined, "plan", "2028-02-29"],
    ["plan in 2 months", WED, undefined, "plan", "2027-01-18"],
    ["plan in 2 months", "2026-12-31", undefined, "plan", "2027-02-28"],
    ["plan in 1 month", "2028-01-31", undefined, "plan", "2028-02-29"],
    ["plan in 3 days", WED, undefined, "plan", "2026-11-21"],
  ])("%s on %s (week start %s)", (text, today, weekStart, title, on) => {
    expect(landsOn(text, today, weekStart)).toMatchObject({ title, on });
  });

  it("says the date it counted, the month spelled out", () => {
    expect(say("plan next week", WED)).toBe("Monday 23 November");
    expect(say("plan next week", WED, 0)).toBe("Sunday 22 November");
    expect(say("plan this weekend", WED)).toBe("Saturday 21 November");
    expect(say("plan next month", "2026-12-15")).toBe("Friday 1 January 2027");
    expect(say("plan tonight", WED)).toBe("today");
  });
});

describe("calendar dates", () => {
  it.each<[string, string, string]>([
    ["pay rent 20 dec", WED, "2026-12-20"],
    ["pay rent dec 20", WED, "2026-12-20"],
    ["pay rent 20th december", WED, "2026-12-20"],
    ["pay rent on 20 dec", WED, "2026-12-20"],
    ["pay rent 20 december 2027", WED, "2027-12-20"],
    ["pay rent 20/12", WED, "2026-12-20"],
    ["pay rent 12/20", WED, "2026-12-20"],
    ["pay rent 20/12/2027", WED, "2027-12-20"],
    ["pay rent 5/6", WED, "2027-06-05"],
    ["pay rent 3 nov", WED, "2027-11-03"],
    ["pay rent 3 nov", "2026-12-30", "2027-11-03"],
    ["pay rent 18 nov", WED, WED],
    ["pay rent 2 jan", "2026-12-30", "2027-01-02"],
  ])("%s on %s lands on %s", (text, today, on) => {
    expect(landsOn(text, today)).toMatchObject({ title: "pay rent", on });
  });

  it("reads 5/6 day first: 5 June", () => {
    expect(say("pay rent 5/6", WED)).toBe("Saturday 5 June 2027");
  });

  it.each(["pay 31/2", "pay 13/13", "pay 0/5", "pay 32 dec", "ratio 3/4 cup"])("keeps %j as typed when it is no date", (text) => {
    const c = parseCapture(text);
    if (text === "ratio 3/4 cup") expect(c.title).toBe(text);
    else expect(c.day).toBeNull();
  });
});

describe("a day after a preposition", () => {
  it.each<[string, string, string]>([
    ["Groceries for Sunday", "Groceries", "2026-11-22"],
    ["call mum on friday", "call mum", "2026-11-20"],
    ["report by thursday", "report", "2026-11-19"],
    ["send invoice by tomorrow", "send invoice", "2026-11-19"],
    ["Groceries for Sunday 9", "Groceries", "2026-11-22"],
  ])("%j plans the day and drops the preposition", (text, title, on) => {
    expect(landsOn(text, WED)).toMatchObject({ title, on });
  });

  it.each([
    "Plan for Monday's meeting",
    "Gift for Sunday school",
    "Prep for Friday night dinner",
    "Notes about Monday",
    "Party until friday",
    "Groceries for every Tuesday",
    "Read the book for Monday club",
  ])("never eats the real title %j", (text) => {
    const c = parseCapture(text);
    expect(c.title).toBe(text);
    expect(c.day).toBeNull();
  });
});

describe("a start counted from now", () => {
  // 2026-11-18 14:07 UTC, in a zone with no change that day.
  const now = new Date("2026-11-18T14:07:00Z");
  it("rounds up to the quarter hour, never sooner than asked", () => {
    expect(soonAt(120, now, "UTC")).toEqual({ on: "2026-11-18", start: 16 * 60 + 15 });
    expect(soonAt(30, now, "UTC")).toEqual({ on: "2026-11-18", start: 14 * 60 + 45 });
    expect(soonAt(8, new Date("2026-11-18T14:07:00Z"), "UTC")).toEqual({ on: "2026-11-18", start: 14 * 60 + 15 });
  });
  it("rolls to tomorrow past midnight, and past the quarter before it", () => {
    expect(soonAt(120, new Date("2026-11-18T23:00:00Z"), "UTC")).toEqual({ on: "2026-11-19", start: 60 });
    expect(soonAt(1, new Date("2026-11-18T23:50:00Z"), "UTC")).toEqual({ on: "2026-11-19", start: 0 });
  });
  it("counts real time across a clock change", () => {
    // Europe/London: 2026-03-29 01:00 UTC is when 01:00 GMT becomes 02:00 BST.
    expect(soonAt(120, new Date("2026-03-29T00:30:00Z"), "Europe/London")).toEqual({ on: "2026-03-29", start: 3 * 60 + 30 });
    // US fall back: 2026-11-01 06:00 UTC is 01:00 EST after 01:59 EDT.
    expect(soonAt(120, new Date("2026-11-01T04:30:00Z"), "America/New_York")).toEqual({ on: "2026-11-01", start: 60 + 30 });
  });
  it("reads the phrase and previews the time it picked", () => {
    const moment = momentAt(now, "UTC");
    for (const [text, said] of [
      ["call Sam in 2 hours", "today, 16:15"],
      ["call Sam in 30 min", "today, 14:45"],
      ["call Sam in 90m", "today, 15:45"],
      ["call Sam in an hour", "today, 15:15"],
      ["call Sam in half an hour", "today, 14:45"],
    ] as const) {
      const c = parseCapture(text);
      expect(c.title).toBe("call Sam");
      expect(previewWords(c, clock24, moment)).toBe(said);
    }
    expect(previewWords(parseCapture("call Sam in 2 hours"), clock24)).toBe("in 2 hours");
  });
  it("is never read beside a repeat, and says so when beside a day (the day then stays in the title)", () => {
    expect(parseCapture("stretch daily in 2 hours").soon).toBeUndefined();
    expect(parseCapture("call Sam tomorrow in 2 hours")).toMatchObject({ title: "call Sam tomorrow", day: null, soon: { after: 120 } });
  });
});

describe("durations and ranges", () => {
  it.each<[string, string, number, number | null]>([
    ["gym 7pm 1h", "gym", 19 * 60, 60],
    ["standup 9:00 15m", "standup", 540, 15],
    ["standup 9:00 90min", "standup", 540, 90],
    ["gym 7pm 1.5h", "gym", 19 * 60, 90],
    ["gym 7pm for 1h 30m", "gym", 19 * 60, 90],
    ["review from 2 to 3:30pm", "review", 14 * 60, 90],
    ["review 2-3pm", "review", 14 * 60, 60],
    ["lunch noon", "lunch", 720, null],
    ["party 10pm to midnight", "party", 22 * 60, 120],
    ["swim midnight", "swim", 0, null],
  ])("%j", (text, title, start, length) => {
    const c = parseCapture(text);
    expect(c.title).toBe(title);
    expect(c.time).toEqual({ start, length });
  });

  it.each(["buy rope 2 m", "run 5k", "gym 1h", "stretch 15m", "chapter 2 h"])("does not read %j as a length without a time", (text) => {
    const c = parseCapture(text);
    expect(c.time).toBeNull();
    expect(c.title).toBe(text);
  });
  it("keeps metres: 'swim 400m 7am' is 7am, not 400 minutes", () => {
    expect(parseCapture("swim 400m 7am")).toMatchObject({ title: "swim 400m", time: { start: 420, length: null } });
  });
});

describe("a due date", () => {
  it("sets the due date and not the planned day", () => {
    const c = parseCapture("write report due friday");
    expect(c).toMatchObject({ title: "write report", day: null, due: { kind: "weekday", weekday: 5, next: false } });
    expect(parseCapture("write report due 20 dec").due).toEqual({ kind: "date", month: 12, day: 20 });
    expect(parseCapture("write report due by tomorrow").due).toEqual({ kind: "in", days: 1 });
  });
  it("sits beside a planned day", () => {
    const c = parseCapture("write report tomorrow due friday");
    expect(c.day).toEqual({ kind: "in", days: 1 });
    expect(c.due).toEqual({ kind: "weekday", weekday: 5, next: false });
  });
  it("previews both", () => {
    expect(say("write report due friday", WED)).toBe("due Friday");
    expect(say("write report due 20 dec", WED)).toBe("due Sunday 20 December");
    expect(say("write report tomorrow due next week", WED)).toBe("tomorrow, due Monday 23 November");
  });
  it("is not read in a title or beside a repeat", () => {
    expect(parseCapture("the due date for rent").due).toBeUndefined();
    expect(parseCapture("write report every day due friday").due).toBeUndefined();
  });
});

describe("an area", () => {
  const areas: CaptureArea[] = [
    { id: "a1" as CaptureArea["id"], name: "Work" },
    { id: "a2" as CaptureArea["id"], name: "Home life" },
  ];
  it("matches an existing area in any case, at either edge", () => {
    for (const text of ["file expenses @work", "@WORK file expenses", "file expenses @Work tomorrow"]) {
      const c = parseCapture(text, { areas });
      expect(c.title).toBe("file expenses");
      expect(c.area).toEqual({ id: "a1", name: "Work" });
    }
  });
  it("keeps an unknown name in the title and says nothing matched", () => {
    const c = parseCapture("file expenses @nope", { areas });
    expect(c).toMatchObject({ title: "file expenses @nope", noArea: "nope" });
    expect(previewWords(c, clock24)).toBe("No area named “nope”, so it stays in the title");
  });
  it("leaves an @ alone when areas are not known, and in mid-title", () => {
    expect(parseCapture("mail bob@example.com").title).toBe("mail bob@example.com");
    expect(parseCapture("file @work expenses", { areas }).title).toBe("file @work expenses");
    expect(parseCapture("file expenses @nope").noArea).toBeUndefined();
  });
  it("previews the area", () => {
    expect(say("file expenses @work tomorrow", WED, undefined, areas)).toBe("tomorrow, @Work");
  });
});

describe("dayOf with the week start", () => {
  it.each<[DayWord, string, WeekStart, string]>([
    [{ kind: "nextWeek" }, "2026-12-30", 1, "2027-01-04"],
    [{ kind: "nextWeek" }, "2026-12-30", 0, "2027-01-03"],
    [{ kind: "weekend", next: false }, "2026-12-30", 1, "2027-01-02"],
    [{ kind: "monthEnd" }, "2026-12-30", 1, "2026-12-31"],
    [{ kind: "nextMonth" }, "2026-12-30", 1, "2027-01-01"],
  ])("%j from %s, week start %s", (word, today, weekStart, on) => {
    expect(dayOf(word, d(today), weekStart)).toBe(on);
  });
});

describe("tags and the rest still read in any order", () => {
  it("reads a phrase list in either order", () => {
    const a = parseCapture("next week gym 7pm 1h #health");
    const b = parseCapture("#health gym 1h 7pm next week");
    expect(a.title).toBe("gym");
    expect(a.tags).toEqual(["health" as TagName]);
    expect(a.time).toEqual({ start: 19 * 60, length: 60 });
    expect(a.day).toEqual({ kind: "nextWeek" });
    expect(b).toMatchObject({ title: "gym", day: a.day, time: a.time, tags: a.tags });
  });
});
