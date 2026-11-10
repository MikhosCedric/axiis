import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { Weekday } from "@/domain/recurrence";
import type { TagName } from "@/domain/tag";
import { cadenceWords, weekdayList } from "./capture-repeat";
import { momentAt, parseCapture, passesToday, previewWords, seriesFor, seriesWords, type CaptureText, type Moment, type DayWord, type RepeatEnd, type RepeatWords } from "./capture-syntax";

const d = (s: string) => s as LocalDate;
const never: RepeatEnd = { kind: "never" };
const daily = (interval = 1, end: RepeatEnd = never): RepeatWords => ({ freq: "daily", interval, byDay: [], end });
const weekly = (byDay: Weekday[] = [], interval = 1, end: RepeatEnd = never): RepeatWords => ({ freq: "weekly", interval, byDay, end });
const monthly = (interval = 1, end: RepeatEnd = never): RepeatWords => ({ freq: "monthly", interval, byDay: [], end });
const yearly = (interval = 1): RepeatWords => ({ freq: "yearly", interval, byDay: [], end: never });
const WORK: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];
const at = (start: string, length: number | null = null) => {
  const [h, m] = start.split(":").map(Number);
  return { start: h * 60 + m, length };
};
const reads = (title: string, repeat: RepeatWords, time: CaptureText["time"] = null, day: DayWord | null = null): CaptureText => ({
  title,
  day,
  time,
  tags: [],
  repeat,
});

describe("parseCapture reads a repeat", () => {
  it.each<[string, CaptureText]>([
    // The owner's line, and the same in other cases and spacing.
    ["every tuesday at 7:30am to 9am gym", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["EVERY Tuesday   at 7:30AM to 9AM   gym", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["gym every tuesday at 7:30am to 9am", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["Every Tuesday 07:30-09:00 Gym", reads("Gym", weekly(["TU"]), at("7:30", 90))],
    // Every day.
    ["gym every day", reads("gym", daily())],
    ["gym daily", reads("gym", daily())],
    ["stretch each day", reads("stretch", daily())],
    ["stretch everyday", reads("stretch", daily())],
    ["journal every morning", reads("journal", daily())],
    ["read every night 22:00", reads("read", daily(), at("22:00"))],
    ["standup daily 9am", reads("standup", daily(), at("9:00"))],
    ["gym 7am every day", reads("gym", daily(), at("7:00"))],
    ["every day 7 gym", reads("gym", daily(), at("7:00"))],
    ["gym every day 7-9", reads("gym", daily(), at("7:00", 120))],
    ["water plants every 3 days", reads("water plants", daily(3))],
    ["water plants every other day", reads("water plants", daily(2))],
    // Weekdays and weekends.
    ["standup every weekday 9:15", reads("standup", weekly(WORK), at("9:15"))],
    ["standup weekdays at 9", reads("standup", weekly(WORK), at("9:00"))],
    ["standup every workday", reads("standup", weekly(WORK))],
    ["standup on weekdays", reads("standup", weekly(WORK))],
    ["standup every week day", reads("standup", weekly(WORK))],
    ["long run weekends", reads("long run", weekly(["SA", "SU"]))],
    ["long run on weekends", reads("long run", weekly(["SA", "SU"]))],
    ["brunch every weekend 11am", reads("brunch", weekly(["SA", "SU"]), at("11:00"))],
    ["visit Gran every other weekend", reads("visit Gran", weekly(["SA", "SU"], 2))],
    // One weekday.
    ["gym every tue", reads("gym", weekly(["TU"]))],
    ["gym every tues", reads("gym", weekly(["TU"]))],
    ["piano tuesdays", reads("piano", weekly(["TU"]))],
    ["piano each tuesday", reads("piano", weekly(["TU"]))],
    ["piano on tuesdays 17:00", reads("piano", weekly(["TU"]), at("17:00"))],
    ["cleaning every other tuesday", reads("cleaning", weekly(["TU"], 2))],
    ["cleaning every 2nd tuesday", reads("cleaning", weekly(["TU"], 2))],
    ["cleaning every second tuesday", reads("cleaning", weekly(["TU"], 2))],
    ["cleaning every 3 weeks on thu", reads("cleaning", weekly(["TH"], 3))],
    ["bins weekly on thursday", reads("bins", weekly(["TH"]))],
    // Several weekdays.
    ["swim every mon, wed and fri 7am", reads("swim", weekly(["MO", "WE", "FR"]), at("7:00"))],
    ["swim every mon, wed, and fri", reads("swim", weekly(["MO", "WE", "FR"]))],
    ["swim mon/wed/fri 7am", reads("swim", weekly(["MO", "WE", "FR"]), at("7:00"))],
    ["swim every monday and thursday", reads("swim", weekly(["MO", "TH"]))],
    ["swim mondays and thursdays", reads("swim", weekly(["MO", "TH"]))],
    ["work mon-fri 9-5", reads("work", weekly(WORK), at("9:00", 480))],
    ["work monday to friday", reads("work", weekly(WORK))],
    ["market fri-sun", reads("market", weekly(["FR", "SA", "SU"]))],
    ["yoga tue & thu 18:00", reads("yoga", weekly(["TU", "TH"]), at("18:00"))],
    ["yoga on tue and thu", reads("yoga", weekly(["TU", "TH"]))],
    ["sync every other week on mon and thu", reads("sync", weekly(["MO", "TH"], 2))],
    // Weeks, months and years.
    ["review every week", reads("review", weekly())],
    ["review weekly", reads("review", weekly())],
    ["sync every 2 weeks", reads("sync", weekly([], 2))],
    ["sync every other week", reads("sync", weekly([], 2))],
    ["sync fortnightly", reads("sync", weekly([], 2))],
    ["sync biweekly", reads("sync", weekly([], 2))],
    ["rent monthly", reads("rent", monthly())],
    ["rent every month", reads("rent", monthly())],
    ["haircut every 3 months", reads("haircut", monthly(3))],
    ["report quarterly", reads("report", monthly(3))],
    ["birthday yearly", reads("birthday", yearly())],
    ["taxes annually", reads("taxes", yearly())],
    ["dues every year", reads("dues", yearly())],
    ["census every 2 years", reads("census", yearly(2))],
    // Times.
    ["gym every tuesday from 7:30 to 9", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["gym every tuesday 7:30-9am", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["gym every tuesday 7:30 until 9", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["gym every tuesday 7:30am for 90 min", reads("gym", weekly(["TU"]), at("7:30", 90))],
    ["gym every tuesday 7-9pm", reads("gym", weekly(["TU"]), at("19:00", 120))],
    ["gym every tuesday 7pm to 9", reads("gym", weekly(["TU"]), at("19:00", 120))],
    ["gym every tuesday 11am to 1", reads("gym", weekly(["TU"]), at("11:00", 120))],
    ["gym every tuesday 19:00", reads("gym", weekly(["TU"]), at("19:00"))],
    ["lunch every day at noon", reads("lunch", daily(), at("12:00"))],
    ["backup every day at midnight", reads("backup", daily(), at("0:00"))],
    ["sleep every day 10pm to 6am", reads("sleep", daily(), at("22:00", 480))],
    ["wind down every day 22:00 to midnight", reads("wind down", daily(), at("22:00", 120))],
    ["meeting every friday between 2 and 3pm", reads("meeting", weekly(["FR"]), at("14:00", 60))],
    // How it ends.
    ["class every tuesday 19:00 for 6 weeks", reads("class", weekly(["TU"], 1, { kind: "for", n: 6, unit: "week" }), at("19:00"))],
    ["class every tuesday for six weeks", reads("class", weekly(["TU"], 1, { kind: "for", n: 6, unit: "week" }))],
    ["pills daily for 10 days", reads("pills", daily(1, { kind: "for", n: 10, unit: "day" }))],
    ["rent monthly for a year", reads("rent", monthly(1, { kind: "for", n: 1, unit: "year" }))],
    ["class every tuesday for 10 times", reads("class", weekly(["TU"], 1, { kind: "count", count: 10 }))],
    ["class every tuesday 10 times", reads("class", weekly(["TU"], 1, { kind: "count", count: 10 }))],
    ["class every tuesday x10", reads("class", weekly(["TU"], 1, { kind: "count", count: 10 }))],
    ["class every tuesday 8x", reads("class", weekly(["TU"], 1, { kind: "count", count: 8 }))],
    ["class every tuesday until 20 dec", reads("class", weekly(["TU"], 1, { kind: "until", day: { kind: "date", month: 12, day: 20 } }))],
    ["class every tuesday until december 20", reads("class", weekly(["TU"], 1, { kind: "until", day: { kind: "date", month: 12, day: 20 } }))],
    ["class every tuesday till the 20th of december", reads("class", weekly(["TU"], 1, { kind: "until", day: { kind: "date", month: 12, day: 20 } }))],
    ["class every tuesday until dec 20, 2027", reads("class", weekly(["TU"], 1, { kind: "until", day: { kind: "on", date: d("2027-12-20") } }))],
    ["class every tuesday until 2027-01-31", reads("class", weekly(["TU"], 1, { kind: "until", day: { kind: "on", date: d("2027-01-31") } }))],
    ["class every tuesday until friday", reads("class", weekly(["TU"], 1, { kind: "until", day: { kind: "weekday", weekday: 5, next: false } }))],
    ["class every tuesday until the end of june", reads("class", weekly(["TU"], 1, { kind: "monthEnd", month: 6 }))],
    ["class every tuesday until end of the month", reads("class", weekly(["TU"], 1, { kind: "monthEnd", month: null }))],
    // The first day.
    ["pills every day starting tomorrow", reads("pills", daily(), null, { kind: "in", days: 1 })],
    ["pills every day from next monday", reads("pills", daily(), null, { kind: "weekday", weekday: 1, next: true })],
    ["pills every day starting 1 dec", reads("pills", daily(), null, { kind: "date", month: 12, day: 1 })],
    ["gym every tuesday tomorrow", reads("gym", weekly(["TU"]), null, { kind: "in", days: 1 })],
  ])("reads %j", (text, expected) => {
    expect(parseCapture(text)).toEqual(expected);
  });

  it.each<[string, CaptureText]>([
    // How often, opening the line: a repeat, as it is at the end.
    ["daily 7am walk", reads("walk", daily(), at("7:00"))],
    ["walk daily 7am", reads("walk", daily(), at("7:00"))],
    ["daily walk 7am", reads("walk", daily(), at("7:00"))],
    ["daily 7 walk", reads("walk", daily(), at("7:00"))],
    ["monthly rent", { ...reads("rent", monthly()), quoteToKeep: "monthly rent" }],
    ["rent monthly", reads("rent", monthly())],
    ["weekly review", { ...reads("review", weekly()), quoteToKeep: "weekly review" }],
    ["daily standup 9am", reads("standup", daily(), at("9:00"))],
    ["weekly review friday 4pm", reads("review", weekly(["FR"]), at("16:00"))],
    ["review weekly friday 4pm", reads("review", weekly(["FR"]), at("16:00"))],
    ["weekly review next friday", reads("review", weekly(), null, { kind: "weekday", weekday: 5, next: true })],
    ["fortnightly sync friday", reads("sync", weekly(["FR"], 2))],
    ["monthly rent until december", reads("rent", monthly(1, { kind: "monthEnd", month: 12 }))],
    ["rent monthly until december", reads("rent", monthly(1, { kind: "monthEnd", month: 12 }))],
    ["gym every tuesday until december", reads("gym", weekly(["TU"], 1, { kind: "monthEnd", month: 12 }))],
    ["gym every tuesday until 31 december", reads("gym", weekly(["TU"], 1, { kind: "until", day: { kind: "date", month: 12, day: 31 } }))],
    ["gym every tuesday till sept", reads("gym", weekly(["TU"], 1, { kind: "monthEnd", month: 9 }))],
  ])("reads %j", (text, expected) => {
    expect(parseCapture(text)).toEqual(expected);
  });

  it("runs until a month to that month's last day, the next one on or after the first day", () => {
    const today = d("2026-11-10");
    expect(seriesFor(monthly(1, { kind: "monthEnd", month: 12 }), today, today)?.rule.end).toEqual({ kind: "until", on: "2026-12-31" });
    expect(seriesFor(monthly(1, { kind: "monthEnd", month: 11 }), today, today)?.rule.end).toEqual({ kind: "until", on: "2026-11-30" });
    expect(seriesFor(monthly(1, { kind: "monthEnd", month: 2 }), today, today)?.rule.end).toEqual({ kind: "until", on: "2027-02-28" });
  });

  it("keeps tags beside a repeat", () => {
    expect(parseCapture("#health gym every tuesday 7:30 #gym")).toEqual({ ...reads("gym", weekly(["TU"]), at("7:30")), tags: ["health", "gym"] as TagName[] });
  });
});

describe("parseCapture keeps what only looks like a repeat in the title", () => {
  it.each([
    // A repeat with nothing else to name it.
    "every tuesday",
    "every other friday",
    "daily",
    // A phrase after a preposition, or after "every" itself.
    "Groceries for every tuesday",
    "Notes from monday",
    // An end or a first day with no repeat.
    "run for 2 days",
    "Party until friday",
    "trip until 20 dec",
    "Read for 6 weeks",
    "starting tomorrow plan",
    // Numbers that are not a plan.
    "pages 10-20",
    "chapters 9 to 12",
    "2x4 planks",
    // Weekday words that are not a list.
    "mon",
    "fri and pizza",
    "every other weekday",
    "every 100 days",
    // Quotes and backslashes keep everything.
    '"gym every tuesday 7:30"',
    '"weekly review"',
    '"daily standup"',
  ])("keeps %j as typed", (text) => {
    const read = parseCapture(text);
    expect(read.repeat).toBeUndefined();
    expect(read.title).toBe(text.replace(/^"|"$/g, ""));
  });

  it("keeps an escaped repeat word, and marks a repeat with no title", () => {
    expect(parseCapture("standup \\daily")).toEqual({ title: "standup daily", day: null, time: null, tags: [] });
    expect(parseCapture("\\daily standup")).toEqual({ title: "daily standup", day: null, time: null, tags: [] });
    expect(parseCapture("every sunday")).toEqual({ title: "every sunday", day: null, time: null, tags: [], untitled: true });
    expect(parseCapture("buy milk").untitled).toBeUndefined();
  });

  it("still reads a plain day, and a length after a time", () => {
    expect(parseCapture("gym tuesday")).toEqual({ title: "gym", day: { kind: "weekday", weekday: 2, next: false }, time: null, tags: [] });
    expect(parseCapture("gym for 30m").repeat).toBeUndefined();
    expect(parseCapture("gym every day 7am for 30m")).toEqual(reads("gym", daily(), at("7:00", 30)));
  });
});

describe("weekdayList", () => {
  it("reads lists and ranges, wrapping past Sunday, and refuses any other word", () => {
    expect(weekdayList("mon, wed and fri")).toEqual({ days: [1, 3, 5], plural: false });
    expect(weekdayList("sat-mon")).toEqual({ days: [6, 0, 1], plural: false });
    expect(weekdayList("tuesdays")).toEqual({ days: [2], plural: true });
    expect(weekdayList("mon and pizza")).toBeNull();
    expect(weekdayList("mon-tue-wed")).toBeNull();
  });
});

describe("seriesFor", () => {
  // Tuesday 10 November 2026.
  const today = d("2026-11-10");

  it("starts on the first day the repeat falls on, today included even late in the day", () => {
    expect(seriesFor(weekly(["TU"]), today, today)).toEqual({ first: "2026-11-10", rule: { freq: "weekly", interval: 1, byDay: [], end: never } });
    expect(seriesFor(weekly(["FR"]), today, today)?.first).toBe("2026-11-13");
    expect(seriesFor(weekly(["MO", "TH"]), today, today)).toEqual({
      first: "2026-11-12",
      rule: { freq: "weekly", interval: 1, byDay: ["MO", "TH"], end: never },
    });
    expect(seriesFor(weekly(WORK), d("2026-11-14"), today)?.first).toBe("2026-11-16");
    expect(seriesFor(daily(), d("2026-11-11"), today)).toEqual({ first: "2026-11-11", rule: { freq: "daily", interval: 1, end: never } });
    expect(seriesFor(monthly(3), today, today)).toEqual({ first: "2026-11-10", rule: { freq: "monthly", interval: 3, end: never } });
  });

  it("passes over today when asked, to the next day the repeat falls on", () => {
    expect(seriesFor(weekly(["TU"]), today, today, true)?.first).toBe("2026-11-17");
    expect(seriesFor(weekly(["TU", "TH"]), today, today, true)?.first).toBe("2026-11-12");
    expect(seriesFor(weekly(), today, today, true)?.first).toBe("2026-11-17");
    expect(seriesFor(weekly(["TU"], 2), today, today, true)?.first).toBe("2026-11-17");
    expect(seriesFor(daily(), today, today, true)?.first).toBe("2026-11-11");
    expect(seriesFor(monthly(), today, today, true)?.first).toBe("2026-12-10");
    expect(seriesFor(yearly(), today, today, true)?.first).toBe("2027-11-10");
    // Only today is passed over; a later first day stays.
    expect(seriesFor(weekly(["FR"]), today, today, true)?.first).toBe("2026-11-13");
    expect(seriesFor(daily(), d("2026-11-12"), today, true)?.first).toBe("2026-11-12");
  });

  it("pins each kind of end to a date or a count", () => {
    const end = (e: RepeatEnd) => seriesFor(weekly(["TU"], 1, e), today, today)?.rule.end;
    expect(end({ kind: "count", count: 10 })).toEqual({ kind: "count", count: 10 });
    // Six Tuesdays: 10 November to 15 December, so it ends the day before the seventh.
    expect(end({ kind: "for", n: 6, unit: "week" })).toEqual({ kind: "until", on: "2026-12-21" });
    expect(end({ kind: "for", n: 3, unit: "day" })).toEqual({ kind: "until", on: "2026-11-12" });
    // A month from 31 January is 28 February, so the last day is the 27th.
    expect(seriesFor(daily(1, { kind: "for", n: 1, unit: "month" }), d("2027-01-31"), today)?.rule.end).toEqual({ kind: "until", on: "2027-02-27" });
    expect(end({ kind: "for", n: 1, unit: "year" })).toEqual({ kind: "until", on: "2027-11-09" });
    expect(end({ kind: "until", day: { kind: "date", month: 12, day: 20 } })).toEqual({ kind: "until", on: "2026-12-20" });
    // A day and month already past this year is next year's.
    expect(end({ kind: "until", day: { kind: "date", month: 2, day: 1 } })).toEqual({ kind: "until", on: "2027-02-01" });
    expect(end({ kind: "monthEnd", month: 6 })).toEqual({ kind: "until", on: "2027-06-30" });
    expect(end({ kind: "monthEnd", month: null })).toEqual({ kind: "until", on: "2026-11-30" });
    expect(end({ kind: "monthEnd", month: 2 })).toEqual({ kind: "until", on: "2027-02-28" });
  });

  it("refuses a repeat that ends before it starts or past the dates Axiis plans on", () => {
    expect(seriesFor(weekly(["FR"], 1, { kind: "until", day: { kind: "in", days: 1 } }), today, today)).toBeNull();
    expect(seriesFor(weekly(["TU"], 1, { kind: "until", day: { kind: "on", date: d("2026-11-01") } }), today, today)).toBeNull();
    expect(seriesFor(yearly(), d("2200-12-31"), today)).not.toBeNull();
    expect(seriesFor({ ...yearly(), end: { kind: "for", n: 5, unit: "year" } }, d("2200-06-01"), today)).toBeNull();
  });
});

describe("how a repeat is said", () => {
  const today = d("2026-11-10");

  it.each<[string, string]>([
    ["every tuesday at 7:30am to 9am gym", "Every Tuesday, 07:30 to 09:00"],
    ["gym every day", "Every day"],
    ["standup weekdays 9:00 #work", "Every weekday, 09:00, #work"],
    ["brunch weekends", "Every weekend"],
    ["swim mon/wed/fri", "Every Monday, Wednesday and Friday"],
    ["cleaning every other tuesday", "Every other Tuesday"],
    ["cleaning every 3 weeks on thu", "Every 3 weeks on Thursday"],
    ["review weekly", "Every week"],
    ["haircut every 3 months", "Every 3 months"],
    ["class every tuesday x10", "Every Tuesday, 10 times"],
    ["class every tuesday for 6 weeks", "Every Tuesday, for 6 weeks"],
    ["class every tuesday until 20 dec", "Every Tuesday, until 20 December"],
    ["class every tuesday until the end of june", "Every Tuesday, until 30 June"],
    ["monthly rent until december", "Every month, until 31 December"],
    ["gym every tuesday until december", "Every Tuesday, until 31 December"],
    ["walk daily until the end of february", "Every day, until the end of February"],
    ["walk daily until the end of the month", "Every day, until the end of the month"],
    ["daily 7am walk", "Every day, 07:00"],
    ["monthly rent", "Every month (in quotes, “monthly rent” stays a title)"],
    ["weekly review", "Every week (in quotes, “weekly review” stays a title)"],
    ["weekly review friday 4pm", "Every Friday, 16:00"],
    ["every sunday", "Add what to do: “every sunday” alone has no title"],
    ["every other friday", "Add what to do: “every other friday” alone has no title"],
    ["pills every day starting tomorrow", "Every day starting tomorrow"],
  ])("previews %j as %j", (text, words) => {
    expect(previewWords(parseCapture(text), "24")).toBe(words);
  });

  it.each<[string, string]>([
    // Tuesday 10 November 2026, 12:00 in London.
    ["cleaning every other friday", "Every other Friday, from 13 Nov"],
    ["sync fortnightly", "Every other Tuesday, from 10 Nov"],
    ["monthly rent until december", "Every month, until 31 December"],
    ["walk daily until the end of february", "Every day, until 28 February 2027"],
    ["walk daily until the end of the month", "Every day, until 30 November"],
  ])("given the moment, previews %j as %j", (text, words) => {
    expect(previewWords(parseCapture(text), "24", momentAt(new Date("2026-11-10T12:00:00Z"), "Europe/London"))).toBe(words);
  });

  it("writes the preview's times on the reader's clock", () => {
    expect(previewWords(parseCapture("every tuesday at 7:30am to 9am gym"), "12")?.replace(/ /g, " ")).toBe("Every Tuesday, 7:30 AM to 9:00 AM");
  });

  it("says a series mid-sentence with its end, naming another year's", () => {
    expect(seriesWords({ freq: "weekly", interval: 1, byDay: [], end: never }, d("2026-11-10"), today)).toBe("every Tuesday");
    expect(seriesWords({ freq: "weekly", interval: 1, byDay: WORK, end: { kind: "count", count: 10 } }, today, today)).toBe("every weekday, 10 times");
    expect(seriesWords({ freq: "daily", interval: 1, end: { kind: "until", on: d("2027-01-07") } }, today, today)).toBe(
      "every day, until Thursday 7 January 2027",
    );
    expect(seriesWords({ freq: "monthly", interval: 1, end: { kind: "count", count: 1 } }, today, today)).toBe("every month, once");
  });

  it.each<[string, string]>([
    // Readings a person could take another way are said out plainly, so they can be fixed before Enter.
    ["clean every 2nd tuesday", "Every other Tuesday"],
    ["clean every second tuesday", "Every other Tuesday"],
    ["clean every 3rd tuesday", "Every 3 weeks on Tuesday"],
    ["review biweekly", "Every other week"],
    ["review fortnightly", "Every other week"],
    ["water plants every 2nd day", "Every other day"],
  ])("says the plain reading of %j: %j", (text, words) => {
    expect(previewWords(parseCapture(text), "24")).toBe(words);
  });

  it("leaves a weekday of the month in the title, as no rule holds it", () => {
    for (const text of ["every 2nd tuesday of the month rent", "rent every first tuesday of the month", "rent last tuesday of the month"]) {
      expect(parseCapture(text).repeat).toBeUndefined();
    }
  });

  it("names a weekly cadence's weekday only when it is known", () => {
    expect(cadenceWords({ freq: "weekly", interval: 2, byDay: [] }, null)).toBe("every other week");
    expect(cadenceWords({ freq: "weekly", interval: 2, byDay: [] }, "WE")).toBe("every other Wednesday");
    expect(cadenceWords({ freq: "weekly", interval: 4, byDay: [] }, "WE")).toBe("every 4 weeks on Wednesday");
    expect(cadenceWords({ freq: "daily", interval: 5, byDay: [] }, null)).toBe("every 5 days");
  });
});

describe("a repeat whose time today has passed", () => {
  const NEW_YORK = "America/New_York";
  // Tuesday 10 November 2026, 20:00 in New York (EST, UTC-5), and 07:00 that morning.
  const evening = momentAt(new Date("2026-11-11T01:00:00Z"), NEW_YORK);
  const morning = momentAt(new Date("2026-11-10T12:00:00Z"), NEW_YORK);

  it("reads the moment on the wall clock of its own day, the days the clocks change included", () => {
    // Sunday 8 March 2026, 07:00 EDT: the clocks went forward at 02:00, so 06:30 has come and 07:30 has not.
    const spring = momentAt(new Date("2026-03-08T11:00:00Z"), NEW_YORK);
    expect(spring.today).toBe("2026-03-08");
    expect([spring.begun(6 * 60 + 30), spring.begun(7 * 60 + 30)]).toEqual([true, false]);
    // Sunday 1 November 2026, 08:15 EST: the clocks went back at 02:00, so 08:30 is still ahead.
    const autumn = momentAt(new Date("2026-11-01T13:15:00Z"), NEW_YORK);
    expect([autumn.begun(8 * 60), autumn.begun(8 * 60 + 30)]).toEqual([true, false]);
  });

  it("passes over today only with a time that has come, and never when today was typed", () => {
    expect(passesToday(parseCapture("gym every tuesday 7:30 to 9"), evening)).toBe(true);
    expect(passesToday(parseCapture("gym every tuesday 7:30 to 9"), morning)).toBe(false);
    expect(passesToday(parseCapture("gym every tuesday"), evening)).toBe(false);
    expect(passesToday(parseCapture("pills every day starting today 7:00"), evening)).toBe(false);
    expect(passesToday(parseCapture("gym tomorrow 7:30"), evening)).toBe(false);
  });

  it("previews the later first day, and today's while the time is ahead", () => {
    const say = (text: string, moment: Moment) => previewWords(parseCapture(text), "24", moment);
    expect(say("gym every tuesday 7:30 to 9", evening)).toBe("Every Tuesday starting Tuesday 17 November, 07:30 to 09:00");
    expect(say("gym every tuesday 7:30 to 9", morning)).toBe("Every Tuesday, 07:30 to 09:00");
    expect(say("pills every day 8am", evening)).toBe("Every day starting tomorrow, 08:00");
    expect(say("pills every day starting today 8am", evening)).toBe("Every day starting today, 08:00");
    // A first day that is not today is kept.
    expect(say("swim every friday 7:00", evening)).toBe("Every Friday, 07:00");
    // Given the moment, a weekly repeat with no weekday names the one it falls on.
    expect(say("review weekly", morning)).toBe("Every Tuesday");
  });
});
