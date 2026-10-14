import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import type { TagName } from "@/domain/tag";
import { CAPTURE_EXAMPLES, capturedLine, dayOf, firstCapturedLine, parseCapture, previewWords, type CaptureText, type DayWord } from "./capture-syntax";
import type { Landed } from "./commands";

const d = (s: string) => s as LocalDate;
const plain = (title: string): CaptureText => ({ title, day: null, time: null, tags: [] });
const tomorrow: DayWord = { kind: "in", days: 1 };

describe("parseCapture", () => {
  it.each<[string, CaptureText]>([
    ["dentist tomorrow 9:00 #health", { title: "dentist", day: tomorrow, time: { start: 540, length: null }, tags: ["health" as TagName] }],
    ["tomorrow 9 dentist", { title: "dentist", day: tomorrow, time: { start: 540, length: null }, tags: [] }],
    ["dentist tomorrow 0930", { title: "dentist", day: tomorrow, time: { start: 570, length: null }, tags: [] }],
    ["Call Mum TOMORROW", { title: "Call Mum", day: tomorrow, time: null, tags: [] }],
    ["Pick up 2 kids tomorrow", { title: "Pick up 2 kids", day: tomorrow, time: null, tags: [] }],
    ["Buy 2 tomorrow", { title: "Buy 2", day: tomorrow, time: null, tags: [] }],
    ["Room 0900 friday", { title: "Room 0900", day: { kind: "weekday", weekday: 5, next: false }, time: null, tags: [] }],
    ["standup at 9", { title: "standup", day: null, time: { start: 540, length: null }, tags: [] }],
    ["standup at 0915", { title: "standup", day: null, time: { start: 555, length: null }, tags: [] }],
    ["lunch 12pm", { title: "lunch", day: null, time: { start: 720, length: null }, tags: [] }],
    ["feed the cat 12am", { title: "feed the cat", day: null, time: { start: 0, length: null }, tags: [] }],
    ["gym 6pm for 45m", { title: "gym", day: null, time: { start: 1080, length: 45 }, tags: [] }],
    ["gym at 6:30 pm for 1h 30m", { title: "gym", day: null, time: { start: 1110, length: 90 }, tags: [] }],
    ["gym 18:00 for 2 hours", { title: "gym", day: null, time: { start: 1080, length: 120 }, tags: [] }],
    ["Run for 30m tomorrow", { title: "Run for 30m", day: tomorrow, time: null, tags: [] }],
    ["plan trip next friday", { title: "plan trip", day: { kind: "weekday", weekday: 5, next: true }, time: null, tags: [] }],
    ["call bank on monday", { title: "call bank", day: { kind: "weekday", weekday: 1, next: false }, time: null, tags: [] }],
    ["renew passport in 3 days", { title: "renew passport", day: { kind: "in", days: 3 }, time: null, tags: [] }],
    ["renew passport in 2 weeks", { title: "renew passport", day: { kind: "in", days: 14 }, time: null, tags: [] }],
    ["taxes 2026-12-24", { title: "taxes", day: { kind: "on", date: d("2026-12-24") }, time: null, tags: [] }],
    ["#work email   Bob #Urgent", { title: "email   Bob", day: null, time: null, tags: ["work", "Urgent"] as TagName[] }],
    ["today I learned", { title: "I learned", day: { kind: "in", days: 0 }, time: null, tags: [] }],
  ])("reads %j", (text, expected) => {
    expect(parseCapture(text)).toEqual(expected);
  });

  it.each([
    "call mum tomorrow's lunch",
    "Read chapter 9",
    "Run for 30m",
    "email #work Bob",
    "taxes 2026-02-30",
    "x 13pm",
    "x 24:00",
    "x 9:60",
    "tomorrow",
    "#",
    "fix \\n handling",
    "\\\\server backup",
    "nine at nine",
  ])("keeps %j as typed", (text) => {
    expect(parseCapture(text)).toEqual(plain(text));
  });

  it("stops at an escaped word and drops its backslash", () => {
    expect(parseCapture("call \\friday")).toEqual(plain("call friday"));
    expect(parseCapture("call \\friday tomorrow")).toEqual({ ...plain("call friday"), day: tomorrow });
    expect(parseCapture("tag \\#health")).toEqual(plain("tag #health"));
    expect(parseCapture("meet \\at 9")).toEqual(plain("meet at 9"));
  });

  it("keeps a quoted line as typed, without its quotes", () => {
    expect(parseCapture('"Meet tomorrow 9:00"')).toEqual(plain("Meet tomorrow 9:00"));
    expect(parseCapture("“Meet friday”")).toEqual(plain("Meet friday"));
    expect(parseCapture('""')).toEqual(plain('""'));
  });

  it("takes each of day, time and length once", () => {
    expect(parseCapture("tomorrow friday")).toEqual({ ...plain("tomorrow"), day: { kind: "weekday", weekday: 5, next: false } });
  });

  it("takes every tag, once in any case, keeping its first spelling", () => {
    expect(parseCapture("#health #Health walk")).toEqual({ ...plain("walk"), tags: ["health" as TagName] });
    expect(parseCapture("dup #Errands #errands")).toEqual({ ...plain("dup"), tags: ["Errands" as TagName] });
    expect(parseCapture("#a dup #B #A #b")).toEqual({ ...plain("dup"), tags: ["a", "B"] as TagName[] });
  });

  it("reads on, next, by, in and at as part of the phrase they open", () => {
    const friday: DayWord = { kind: "weekday", weekday: 5, next: false };
    expect(parseCapture("dentist on friday at 9:00")).toEqual({ ...plain("dentist"), day: friday, time: { start: 540, length: null } });
    expect(parseCapture("report by tomorrow")).toEqual({ ...plain("report"), day: tomorrow });
    expect(parseCapture("report by friday")).toEqual({ ...plain("report"), day: friday });
    expect(parseCapture("rent by 2026-11-01")).toEqual({ ...plain("rent"), day: { kind: "on", date: d("2026-11-01") } });
    expect(parseCapture("by tomorrow call the bank")).toEqual({ ...plain("call the bank"), day: tomorrow });
  });

  it.each([
    "Groceries for Sunday",
    "Party until friday",
    "Leave before tomorrow",
    "Ask about today",
    "Shop for #groceries",
    "Book a table for 9:00",
    "Meet at friday",
    "Plans after next friday",
    "Nap until 9am",
  ])("never leaves a preposition dangling: keeps %j as typed", (text) => {
    expect(parseCapture(text)).toEqual(plain(text));
  });

  it("reads what follows a dangling-preposition phrase, and no bare hour after it", () => {
    expect(parseCapture("Groceries for Sunday #home")).toEqual({ ...plain("Groceries for Sunday"), tags: ["home" as TagName] });
    expect(parseCapture("Groceries for Sunday 9")).toEqual(plain("Groceries for Sunday 9"));
    expect(parseCapture("Groceries for Sunday tomorrow")).toEqual({ ...plain("Groceries for Sunday"), day: tomorrow });
  });

  it("reads a bare hour only right after a day", () => {
    expect(parseCapture("call 9 tomorrow")).toEqual({ ...plain("call 9"), day: tomorrow });
    expect(parseCapture("call in 3 days 9")).toEqual({ ...plain("call"), day: { kind: "in", days: 3 }, time: { start: 540, length: null } });
  });
});

describe("dayOf", () => {
  // A Wednesday; weeks start on Monday.
  const today = d("2026-10-07");
  it.each<[DayWord, string]>([
    [{ kind: "in", days: 0 }, "2026-10-07"],
    [{ kind: "in", days: 1 }, "2026-10-08"],
    [{ kind: "in", days: 30 }, "2026-11-06"],
    [{ kind: "weekday", weekday: 3, next: false }, "2026-10-07"],
    [{ kind: "weekday", weekday: 5, next: false }, "2026-10-09"],
    [{ kind: "weekday", weekday: 1, next: false }, "2026-10-12"],
    [{ kind: "weekday", weekday: 5, next: true }, "2026-10-16"],
    [{ kind: "weekday", weekday: 1, next: true }, "2026-10-12"],
    [{ kind: "on", date: d("2027-01-02") }, "2027-01-02"],
  ])("%j is %s", (word, date) => {
    expect(dayOf(word, today)).toBe(date);
  });
});

describe("previewWords", () => {
  it("says what a line will do, or nothing for a plain title", () => {
    expect(previewWords(parseCapture("dentist tomorrow 9:00 #health"))).toBe("tomorrow, 09:00, #health");
    expect(previewWords(parseCapture("gym at 23:30 for 1h"))).toBe("today, 23:30 to 00:30");
    expect(previewWords(parseCapture("trip next friday"))).toBe("next Friday");
    expect(previewWords(parseCapture("trip in 3 days"))).toBe("in 3 days");
    expect(previewWords(parseCapture("taxes 2026-12-24"))).toBe("Thursday 24 December");
    expect(previewWords(parseCapture("#a walk #b"))).toBe("#a, #b");
    expect(previewWords(parseCapture("walk the dog"))).toBeNull();
  });
});

const base = { ok: true as const, id: "x" as ItemId, type: "task" as const, title: "dentist", landed: null, tags: [], missed: [] };
const tags = (...names: string[]) => names as TagName[];
const landed = (day: string, start?: string, end?: string): Landed => ({
  on: d("2026-10-19"),
  day,
  time: start ? { start, end: end ?? null } : null,
});

describe("capturedLine", () => {
  it("says where the item went, in the field and in the palette", () => {
    expect(capturedLine(base, "field")).toBe("Captured. It is waiting for a time, below.");
    expect(capturedLine(base, "palette")).toBe("Captured “dentist”. It is waiting for a time on Today.");
    const planned = { ...base, landed: landed("tomorrow", "09:00"), tags: tags("health") };
    expect(capturedLine(planned, "field")).toBe("Planned for tomorrow, 09:00, with #health.");
    expect(capturedLine(planned, "palette")).toBe("Captured “dentist”. Planned for tomorrow, 09:00, with #health.");
    expect(capturedLine({ ...base, landed: landed("today", "22:00", "22:45") }, "field")).toBe("Planned for today, 22:00 to 22:45.");
    expect(capturedLine({ ...base, landed: landed("today") }, "field")).toBe("Planned for today.");
    expect(capturedLine({ ...base, tags: tags("a", "b", "c") }, "field")).toBe(
      "Captured with #a, #b and #c. It is waiting for a time, below.",
    );
  });

  it("names tags that did not save, and speaks of a checklist's lines", () => {
    expect(capturedLine({ ...base, missed: tags("a", "b") }, "field")).toBe(
      "Captured. It is waiting for a time, below. The tags #a and #b did not save.",
    );
    expect(capturedLine({ ...base, missed: tags("a") }, "field")).toMatch(/The tag #a did not save\.$/);
    expect(capturedLine({ ...base, type: "checklist" }, "field")).toBe("Captured. It is open, ready for its lines.");
  });
});

describe("CAPTURE_EXAMPLES", () => {
  it("are lines capture reads as written: two plans and one plain line", () => {
    expect(CAPTURE_EXAMPLES.map((line) => previewWords(parseCapture(line)) !== null)).toEqual([true, true, false]);
    expect(parseCapture(CAPTURE_EXAMPLES[0])).toMatchObject({ title: "dentist", time: { start: 540 }, tags: ["health"] });
    expect(parseCapture(CAPTURE_EXAMPLES[1])).toMatchObject({ title: "call Sam", time: { start: 840, length: 30 } });
  });
});

describe("firstCapturedLine", () => {
  it("says the day and time in a sentence and links to that day", () => {
    expect(firstCapturedLine({ ...base, landed: landed("Monday 19 October", "09:00"), tags: tags("health") })).toEqual({
      text: "Dentist is on Monday 19 October at 09:00, tagged #health.",
      link: { href: "/day/2026-10-19", label: "See Monday 19 October" },
    });
  });

  it("names a typed length's end, a day with no time, and today and tomorrow without 'on'", () => {
    const call = { ...base, title: "call Sam" };
    expect(firstCapturedLine({ ...call, landed: landed("tomorrow", "14:00", "14:30") }).text).toBe("Call Sam is tomorrow from 14:00 to 14:30.");
    expect(firstCapturedLine({ ...call, landed: landed("Friday 16 October") }).text).toBe("Call Sam is on Friday 16 October, at any time.");
    expect(firstCapturedLine({ ...call, landed: landed("today", "09:00") })).toEqual({
      text: "Call Sam is today at 09:00.",
      link: { href: "/today", label: "See today" },
    });
  });

  it("sends an item with no day to the Inbox, and names tags that did not save", () => {
    expect(firstCapturedLine({ ...base, title: "buy milk", missed: tags("shop") })).toEqual({
      text: "Buy milk is waiting, with no day yet. The tag #shop did not save.",
      link: { href: "/inbox", label: "See the Inbox" },
    });
  });
});
