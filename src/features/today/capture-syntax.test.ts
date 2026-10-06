import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import type { TagName } from "@/domain/tag";
import { capturedLine, dayOf, parseCapture, previewWords, type CaptureText, type DayWord } from "./capture-syntax";

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

  it("takes each of day, time and length once, and a tag once in any case", () => {
    expect(parseCapture("tomorrow friday")).toEqual({ ...plain("tomorrow"), day: { kind: "weekday", weekday: 5, next: false } });
    expect(parseCapture("#health #Health walk")).toEqual({ ...plain("#Health walk"), tags: ["health" as TagName] });
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

describe("capturedLine", () => {
  const base = { ok: true as const, id: "x" as ItemId, type: "task" as const, title: "dentist", plan: null, tags: [], missed: [] };
  const tags = (...names: string[]) => names as TagName[];

  it("says where the item went, in the field and in the palette", () => {
    expect(capturedLine(base, "field")).toBe("Captured. It is waiting for a time, below.");
    expect(capturedLine(base, "palette")).toBe("Captured “dentist”. It is waiting for a time on Today.");
    const planned = { ...base, plan: "tomorrow, 09:00", tags: tags("health") };
    expect(capturedLine(planned, "field")).toBe("Planned for tomorrow, 09:00, with #health.");
    expect(capturedLine(planned, "palette")).toBe("Captured “dentist”. Planned for tomorrow, 09:00, with #health.");
    expect(capturedLine({ ...base, plan: "today" }, "field")).toBe("Planned for today.");
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
    expect(capturedLine({ ...base, type: "checklist", plan: "Friday 9 October", tags: tags("trip") }, "field")).toBe(
      "Planned for Friday 9 October, with #trip. It is open, ready for its lines.",
    );
  });
});
