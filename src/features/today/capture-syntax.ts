import type { Area, LocalDate } from "@/domain/item";
import { MAX_COUNT, type Rule, type RuleEnd } from "@/domain/recurrence";
import { parseTagName, tagKey, type TagName } from "@/domain/tag";
import { WEEK_LENGTH, WEEK_STARTS_ON, weekOf, type WeekStart } from "@/features/week/week-of";
import { addDays, instantAt, parseLocalDate, toLocalDate, wallMinutes } from "@/lib/dates";
import type { CaptureResult, Landed } from "./commands";
import { formatMinutes, type Clock } from "@/lib/clock";
import { cadenceHit, cadenceWords, dateWords, monthName, monthWord, ruleDay, type Cadence } from "./capture-repeat";
import { formatDayHeading, formatDayIn } from "./format";

/** A day as typed, before it is pinned to a date: that needs today, which only the server knows for sure. */
export type DayWord =
  | { kind: "in"; days: number }
  | { kind: "weekday"; weekday: number; next: boolean }
  | { kind: "on"; date: LocalDate }
  /** A day and month with no year ("20 dec", "20/12"): the next one from the day it is counted from, so one already past this year is next year's. */
  | { kind: "date"; month: number; day: number }
  /** "next week": the first day of next week, by the week start. */
  | { kind: "nextWeek" }
  /** "this weekend" is the coming Saturday (today on a Saturday or a Sunday); "next weekend" is the Saturday a week after that one. */
  | { kind: "weekend"; next: boolean }
  /** "in 2 months": this day of that month, or its last day when it is shorter. */
  | { kind: "months"; months: number }
  /** "next month": its first day. */
  | { kind: "nextMonth" }
  /** "end of month": this month's last day. */
  | { kind: "monthEnd" };

/** An area a line names with "@": the stored one it matched. */
export type CaptureArea = Pick<Area, "id" | "name">;

/** "in 2 hours": minutes from the moment the line is read, and the length only when one was typed. */
export type CaptureSoon = { after: number; length: number | null };

/** A start in minutes past local midnight, and the length only when one was typed. */
export type CaptureTime = { start: number; length: number | null };

/** When a typed repeat stops, before it is pinned to dates: "10 times", "for 6 weeks", "until 20 dec", "until the end of june". */
export type RepeatEnd =
  | { kind: "never" }
  | { kind: "count"; count: number }
  | { kind: "for"; n: number; unit: "day" | "week" | "month" | "year" }
  | { kind: "until"; day: DayWord }
  /** The last day of a month: `month` 1 to 12, or null for the first day's own month. */
  | { kind: "monthEnd"; month: number | null };

/** How a line repeats, as typed. */
export type RepeatWords = Cadence & { end: RepeatEnd };

/**
 * What capture understood in a line of text. Anything not understood stays in
 * the title. `repeat` is there only when the line repeats; its `day`, if any,
 * is the first day it counts from ("starting tomorrow").
 */
export type CaptureText = {
  title: string;
  day: DayWord | null;
  time: CaptureTime | null;
  tags: TagName[];
  /** "in 2 hours", "in 30 min": a start counted from now, in place of a day and a time. */
  soon?: CaptureSoon;
  /** "due friday": the deadline, apart from the day it is planned for. Never beside a repeat, which takes none. */
  due?: DayWord;
  /** "@work": the area it matched, in any case. */
  area?: CaptureArea;
  /** An "@name" at the title's edge that is no area: it stays in the title and the preview says so. */
  noArea?: string;
  repeat?: RepeatWords;
  /** Set when a lone "weekly" or "daily" opening the line was read as the repeat and nothing else was: the words that, in quotes, would stay a title ("weekly review"). */
  quoteToKeep?: string;
  /** Set when the line is all title only because it is a repeat with nothing to name it ("every sunday"). */
  untitled?: true;
  /** The first day of the week "next week" counts from; set only when it is not Monday, so a Monday line is read as it always was. */
  weekStart?: WeekStart;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const CONNECTORS = new Set(["on", "next", "in", "at", "for", "by"]);
/**
 * Words that tie what follows them into the title. A phrase is never read
 * right after one, so "Party until friday" keeps its Friday. Phrases that
 * start with one of them ("on friday", "by tomorrow", "for sunday", "at 9",
 * "in 3 days", "next friday", "for 45m", "until 20 dec", "due friday") are read
 * whole, preposition included, and only at the line's edge: "Plan for Monday's
 * meeting" and "Gift for Sunday school" keep every word.
 * "every" and "each" are here too, so "Groceries for every tuesday" keeps its Tuesday.
 */
const PREPOSITIONS = new Set([
  ...CONNECTORS,
  "until",
  "till",
  "before",
  "after",
  "from",
  "to",
  "about",
  "since",
  "of",
  "with",
  "every",
  "each",
  "due",
]);
const DAY_MINUTES = 24 * 60;
/** The most words one phrase spans: "every 2 weeks on mon, wed and fri", "until the end of june". */
const MAX_WORDS = 8;

type Hit =
  | { slot: "day"; day: DayWord; starting: boolean }
  | { slot: "time"; start: number; length: number | null; bare: boolean }
  | { slot: "length"; minutes: number }
  | { slot: "soon"; after: number }
  | { slot: "due"; day: DayWord }
  | { slot: "area"; area: CaptureArea }
  | { slot: "tag"; name: TagName }
  | { slot: "repeat"; cadence: Cadence; adverb: boolean }
  | { slot: "end"; end: RepeatEnd };

type Token = { text: string; low: string; from: number; to: number };

const countWord = (w: string) => (/^\d/.test(w) ? Number(w) : 1);

/**
 * A date in figures, day first as dates are shown here: "20/12" and "20/12/2027" are 20 December.
 * Only when the second figure cannot be a month is it read month first, so "12/20" is 20 December too.
 */
function figuresHit(p: string): DayWord | null {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(p);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const [day, month] = b > 12 && a <= 12 ? [b, a] : [a, b];
  if (month < 1 || month > 12 || day < 1 || day > MONTH_LENGTHS[month - 1]) return null;
  if (m[3] === undefined) return { kind: "date", month, day };
  const on = parseLocalDate(`${m[3]}-${pad(month)}-${pad(day)}`);
  return on ? { kind: "on", date: on } : null;
}

const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A day: "today", "tonight", "tomorrow", a weekday, "next friday", "next week",
 * "this weekend", "next month", "end of month", "in 3 days", "in 2 months", and
 * a calendar date ("2026-12-24", "20 dec", "dec 20", "20 december 2027",
 * "20/12"). "on", "by" or "for" may open any of them but the "in" ones.
 * "tonight" is today with no time: Axiis has no evening to put it in.
 */
function dayHit(p: string): DayWord | null {
  let m = /^in (\d{1,3}|an?|one) (days?|weeks?|months?)$/.exec(p);
  if (m) {
    const n = countWord(m[1]);
    if (m[2].startsWith("month")) return n >= 1 && n <= 120 ? { kind: "months", months: n } : null;
    return { kind: "in", days: m[2].startsWith("week") ? n * WEEK_LENGTH : n };
  }
  const w = p.replace(/^(?:on|by|for) /, "");
  if (w === "today" || w === "tonight") return { kind: "in", days: 0 };
  if (w === "tomorrow") return { kind: "in", days: 1 };
  m = /^(next )?([a-z]+)$/.exec(w);
  if (m && WEEKDAYS.includes(m[2])) return { kind: "weekday", weekday: WEEKDAYS.indexOf(m[2]), next: m[1] !== undefined };
  if (w === "next week") return { kind: "nextWeek" };
  if (w === "next month") return { kind: "nextMonth" };
  m = /^(this|the|next) weekend$/.exec(w);
  if (m) return { kind: "weekend", next: m[1] === "next" };
  if (/^(?:the )?end of (?:the |this )?month$/.test(w)) return { kind: "monthEnd" };
  m = /^(\d{4}-\d{2}-\d{2})$/.exec(w);
  if (m) {
    const date = parseLocalDate(m[1]);
    return date ? { kind: "on", date } : null;
  }
  const figures = figuresHit(w);
  if (figures) return figures;
  const date = dateWords(w);
  if (!date) return null;
  if (date.year === null) return { kind: "date", month: date.month, day: date.day };
  const on = parseLocalDate(`${date.year}-${pad(date.month)}-${pad(date.day)}`);
  return on ? { kind: "on", date: on } : null;
}

/** A day as "until", "starting" and "due" take it. */
const dateHit = dayHit;

/** "in 2 hours", "in 30 min", "in an hour", "in half an hour": minutes from now, up to two days. */
function soonHit(p: string): number | null {
  const m = /^in (\d{1,4}|an?|one|half an) ?(h|hr|hrs|hours?|m|min|mins|minutes?)$/.exec(p);
  if (!m) return null;
  const hours = m[2].startsWith("h");
  const after = m[1] === "half an" ? (hours ? 30 : 0) : countWord(m[1]) * (hours ? 60 : 1);
  return after >= 1 && after <= 2 * DAY_MINUTES ? after : null;
}

/** "due friday", "due 20 dec", "due by tomorrow": a deadline. */
function dueHit(p: string): DayWord | null {
  const m = /^due (.+)$/.exec(p);
  return m ? dayHit(m[1]) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (h: number, m: number) => (h < 24 && m < 60 ? h * 60 + m : null);

/** One clock time. `meridiem` is set when AM or PM was said (or noon, midnight); `bare` is a plain hour or four digits. */
type Clocked = { minutes: number; meridiem: boolean; bare: boolean };

function clockWord(t: string): Clocked | null {
  if (t === "noon" || t === "midday") return { minutes: 720, meridiem: true, bare: false };
  if (t === "midnight") return { minutes: 0, meridiem: true, bare: false };
  let m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) {
    const minutes = clock(Number(m[1]), Number(m[2]));
    return minutes === null ? null : { minutes, meridiem: false, bare: false };
  }
  m = /^(\d{1,2})(?::(\d{2}))? ?(am|pm)$/.exec(t);
  if (m) {
    const h = Number(m[1]);
    const minutes = h >= 1 && h <= 12 ? clock((h % 12) + (m[3] === "pm" ? 12 : 0), Number(m[2] ?? 0)) : null;
    return minutes === null ? null : { minutes, meridiem: true, bare: false };
  }
  m = /^(\d{1,2})$/.exec(t) ?? /^(\d{2})(\d{2})$/.exec(t);
  if (m) {
    const minutes = clock(Number(m[1]), Number(m[2] ?? 0));
    return minutes === null ? null : { minutes, meridiem: false, bare: true };
  }
  return null;
}

/**
 * A start and end, reading AM and PM the least surprising way: "7-9pm" is
 * 19:00 to 21:00, "11am to 1" ends at 13:00, "9-5" ends at 17:00, and an end
 * at or before the start ("22:00 to 1:00", "10pm to midnight") runs past midnight.
 */
function span(a: Clocked, b: Clocked): { start: number; length: number } | null {
  let start = a.minutes;
  let end = b.minutes;
  if (!a.meridiem && b.meridiem && start < 720 && start + 720 < end) start += 720;
  if (!b.meridiem && end <= start && end < 720 && end + 720 > start) end += 720;
  if (end <= start) end += DAY_MINUTES;
  const length = end - start;
  return length < DAY_MINUTES ? { start, length } : null;
}

const CLOCK = String.raw`(\d{1,2}(?::\d{2})?(?: ?[ap]m)?|noon|midday|midnight)`;
const RANGE = new RegExp(String.raw`^(?:(at|from|between) )?${CLOCK} ?(-|–|to|until|till|and) ?${CLOCK}$`);

/**
 * A clock time, or a start and end ("7:30-9am", "from 7:30 to 9", "between 6
 * and 7pm"). `bare` is a plain hour or four digits, which mean a time only
 * right after a day or a repeat; "at" makes any of them a time.
 */
function timeHit(p: string): { start: number; length: number | null; bare: boolean } | null {
  const range = RANGE.exec(p);
  if (range && (range[3] === "and") === (range[1] === "between")) {
    const [a, b] = [clockWord(range[2]), clockWord(range[4])];
    const both = a && b && span(a, b);
    return both ? { ...both, bare: range[1] !== "at" && a.bare && b.bare } : null;
  }
  const at = p.startsWith("at ");
  const one = clockWord(at ? p.slice(3) : p);
  return one && { start: one.minutes, length: null, bare: one.bare && !at };
}

/** A bare length in minutes written with one letter is read up to this, so "swim 400m 7am" keeps its metres. */
const BARE_M_MAX = 180;

/**
 * A length: "for 45m", "for 1h 30m", and without "for" when the unit is
 * joined to its figure or spelled out: "1h", "15m", "90min", "1.5h", "2 hours".
 */
function lengthHit(p: string): number | null {
  const m = /^(for )?(?:(\d{1,2}(?:\.5)?)( ?)(h|hr|hrs|hour|hours))? ?(?:(\d{1,4})( ?)(m|min|mins|minute|minutes))?$/.exec(p);
  if (!m || (m[2] === undefined && m[5] === undefined)) return null;
  if (m[1] === undefined) {
    // "buy rope 2 m" is not two minutes.
    if ((m[3] === " " && m[4] === "h") || (m[6] === " " && m[7] === "m")) return null;
    if (m[2] === undefined && m[7] === "m" && Number(m[5]) > BARE_M_MAX) return null;
  }
  const minutes = Number(m[2] ?? 0) * 60 + Number(m[5] ?? 0);
  return minutes > 0 && minutes <= DAY_MINUTES ? minutes : null;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const numberWord = (w: string) => (/^\d+$/.test(w) ? Number(w) : w === "a" || w === "an" ? 1 : NUMBER_WORDS.indexOf(w));

/** When a repeat stops: "10 times", "x10", "for 6 weeks", "until 20 dec", "until friday", "until the end of june". */
function endHit(p: string): RepeatEnd | null {
  let m = /^(?:for )?(\d{1,4}) (?:times?|occurrences?|sessions?)$/.exec(p) ?? /^x ?(\d{1,4})$/.exec(p) ?? /^(\d{1,4}) ?x$/.exec(p);
  if (m) {
    const count = Number(m[1]);
    return count >= 1 && count <= MAX_COUNT ? { kind: "count", count } : null;
  }
  m = /^for (\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (day|week|month|year)s?$/.exec(p);
  if (m) {
    const n = numberWord(m[1]);
    return n >= 1 ? { kind: "for", n, unit: m[2] as "day" | "week" | "month" | "year" } : null;
  }
  m = /^(?:until|till|til|through|thru|ending|ends|up to) (.+)$/.exec(p);
  if (!m) return null;
  const end = /^(?:the )?end of (?:the )?([a-z]+)$/.exec(m[1]);
  if (end) {
    if (end[1] === "month") return { kind: "monthEnd", month: null };
    if (end[1] === "year") return { kind: "monthEnd", month: 12 };
    const month = monthWord(end[1]);
    return month === null ? null : { kind: "monthEnd", month };
  }
  const day = dateHit(m[1]);
  if (day) return { kind: "until", day };
  // A month alone ("until december") runs to that month's last day.
  const month = monthWord(m[1]);
  return month === null ? null : { kind: "monthEnd", month };
}

/** The first day a repeat counts from: "starting tomorrow", "from next monday", "starting 1 dec". */
function startingHit(p: string): DayWord | null {
  const m = /^(?:starting|from|beginning|begins|starts) (?:on |from )?(.+)$/.exec(p);
  return m ? dateHit(m[1]) : null;
}

function hitAt(tokens: readonly Token[], from: number, to: number, areas: readonly CaptureArea[] = []): Hit | null {
  const words = tokens.slice(from, to);
  if (words.length === 1 && /^#[^#\s]/.test(words[0].text)) {
    const name = parseTagName(words[0].text);
    return name ? { slot: "tag", name } : null;
  }
  const p = words.map((w) => w.low).join(" ");
  if (p.startsWith("@")) {
    const area = areas.find((a) => areaKey(a.name) === p.slice(1));
    return area ? { slot: "area", area: { id: area.id, name: area.name } } : null;
  }
  const day = dayHit(p);
  if (day) return { slot: "day", day, starting: false };
  const time = timeHit(p);
  if (time) return { slot: "time", ...time };
  const length = lengthHit(p);
  if (length !== null) return { slot: "length", minutes: length };
  const soon = soonHit(p);
  if (soon !== null) return { slot: "soon", after: soon };
  const due = dueHit(p);
  if (due) return { slot: "due", day: due };
  const repeat = cadenceHit(p);
  if (repeat) {
    const { adverb, ...cadence } = repeat;
    return { slot: "repeat", cadence, adverb };
  }
  const end = endHit(p);
  if (end) return { slot: "end", end };
  const starting = startingHit(p);
  return starting && { slot: "day", day: starting, starting: true };
}

/** An area's name as "@" matches it: any case, single spaces. */
const areaKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * True when the word before `at` is a preposition, so a phrase starting at `at` belongs to the title.
 * So does "the" after one: "Party until the end of the month".
 */
const dangles = (tokens: readonly Token[], at: number) =>
  at > 0 && (PREPOSITIONS.has(tokens[at - 1].low) || (at > 1 && tokens[at - 1].low === "the" && PREPOSITIONS.has(tokens[at - 2].low)));

/** A day or a repeat: a bare hour right after one reads as a time. */
const opensTime = (hit: Hit | null) => hit?.slot === "day" || hit?.slot === "repeat";

/** True when a day or repeat phrase that would be read ends just before `end`, so a bare hour after it reads as a time. */
function dayEndsAt(tokens: readonly Token[], lo: number, end: number): boolean {
  for (let n = 1; n <= MAX_WORDS && end - n >= lo; n++) {
    if (opensTime(hitAt(tokens, end - n, end)) && !dangles(tokens, end - n)) return true;
  }
  return false;
}

type Scan = { lo: number; hi: number; found: { hit: Hit; at: number }[] };
/**
 * `length`: a length may be read. `repeatOnly`: an end or a "starting" day, which mean something only beside a repeat.
 * `oneOff`: a start counted from now ("in 2 hours") or a due date, which a repeat cannot take.
 */
type Allow = { length: boolean; repeatOnly: boolean; oneOff: boolean };

/**
 * Peels recognised phrases off the end of the line, then off its start, and
 * stops at the first word on each side that is not one. Each of day, time,
 * length, repeat and end is taken once.
 */
function scan(tokens: readonly Token[], allow: Allow, areas: readonly CaptureArea[]): Scan {
  let lo = 0;
  let hi = tokens.length;
  const found: Scan["found"] = [];
  const taken = new Set<string>();
  const fits = (hit: Hit, afterDay: boolean) => {
    if (hit.slot === "tag") return true;
    if (taken.has(hit.slot)) return false;
    switch (hit.slot) {
      case "length":
        return allow.length;
      case "soon":
        // It is a day and a time at once, so it is read only when neither was.
        return allow.oneOff && !taken.has("day") && !taken.has("time");
      case "due":
        return allow.oneOff;
      case "area":
        return true;
      case "end":
        return allow.repeatOnly;
      case "day":
        return allow.repeatOnly || !hit.starting;
      case "repeat":
        return true;
      case "time":
        return (hit.length === null || (allow.length && !taken.has("length"))) && (!hit.bare || afterDay);
    }
  };
  const take = (hit: Hit, at: number) => {
    found.push({ hit, at });
    taken.add(hit.slot);
    if (hit.slot === "time" && hit.length !== null) taken.add("length");
    if (hit.slot === "soon") ["day", "time"].forEach((slot) => taken.add(slot));
  };
  const at = (from: number, to: number) => hitAt(tokens, from, to, areas);

  fromEnd: while (hi > lo) {
    for (let n = Math.min(MAX_WORDS, hi - lo); n >= 1; n--) {
      const hit = at(hi - n, hi);
      if (hit && !dangles(tokens, hi - n) && fits(hit, dayEndsAt(tokens, lo, hi - n))) {
        take(hit, hi - n);
        hi -= n;
        continue fromEnd;
      }
    }
    break;
  }

  let afterDay = false;
  fromStart: while (lo < hi) {
    for (let n = Math.min(MAX_WORDS, hi - lo); n >= 1; n--) {
      const hit = at(lo, lo + n);
      // "every 2nd tuesday of the month" is not every other Tuesday, and Axiis has no rule for it, so it stays in the title.
      const ofMonth = hit?.slot === "repeat" && tokens[lo + n]?.low === "of";
      if (hit && !ofMonth && fits(hit, afterDay)) {
        take(hit, lo);
        afterDay = opensTime(hit);
        lo += n;
        continue fromStart;
      }
    }
    break;
  }
  return { lo, hi, found };
}

/** Drops the backslash from a word that would otherwise be read as a day, time, length, repeat or tag. */
function unescape(title: string): string {
  return title.replace(/(^|\s)\\([^\s\\]\S*)/g, (whole, space: string, word: string) => {
    const token = { text: word, low: word.toLowerCase(), from: 0, to: word.length };
    return hitAt([token], 0, 1) || CONNECTORS.has(token.low) ? space + word : whole;
  });
}

/**
 * Reads a captured line: a day, a start time or a start and end, a length,
 * a repeat and how it ends, and tags at its start or end, as in "dentist
 * tomorrow 9:00 #health" or "every tuesday at 7:30am to 9am gym". Only whole
 * words are read, and only from the edges inward, so a word that is not part
 * of a phrase keeps everything behind it in the title. A length needs a time,
 * and an end ("for 6 weeks") or a first day ("starting monday") needs a
 * repeat; without one they stay in the title. A lone "daily" or "weekly"
 * repeats at either end ("daily 7am walk", "monthly rent"); a weekly one with
 * a plain weekday falls on that weekday. A line in quotes ("weekly review"),
 * or a word after a backslash, stays as typed. A line that would leave no
 * title is all title.
 */
export function parseCapture(text: string, options: { weekStart?: WeekStart; areas?: readonly CaptureArea[] } = {}): CaptureText {
  const read = readCapture(text, options.areas);
  return options.weekStart !== undefined && options.weekStart !== WEEK_STARTS_ON ? { ...read, weekStart: options.weekStart } : read;
}

function readCapture(text: string, areas?: readonly CaptureArea[]): CaptureText {
  const line = text.trim();
  const literal: CaptureText = { title: line, day: null, time: null, tags: [] };
  const quoted = /^["“]([\s\S]*)["”]$/.exec(line);
  if (quoted) return quoted[1].trim() ? { ...literal, title: quoted[1].trim() } : literal;

  const tokens: Token[] = [...line.matchAll(/\S+/g)].map((m) => ({
    text: m[0],
    low: m[0].toLowerCase(),
    from: m.index,
    to: m.index + m[0].length,
  }));
  const allow: Allow = { length: true, repeatOnly: true, oneOff: true };
  let read = scan(tokens, allow, areas ?? []);
  for (;;) {
    const has = (slot: Hit["slot"]) => read.found.some((f) => f.hit.slot === slot);
    const lengthAlone = allow.length && has("length") && !has("time") && !has("soon");
    const oneOffRepeats = allow.oneOff && has("repeat") && (has("soon") || has("due"));
    const repeatOnlyAlone =
      allow.repeatOnly && !has("repeat") && read.found.some((f) => f.hit.slot === "end" || (f.hit.slot === "day" && f.hit.starting));
    if (!lengthAlone && !repeatOnlyAlone && !oneOffRepeats) break;
    if (lengthAlone) allow.length = false;
    if (repeatOnlyAlone) allow.repeatOnly = false;
    if (oneOffRepeats) allow.oneOff = false;
    read = scan(tokens, allow, areas ?? []);
  }
  if (read.lo >= read.hi) {
    const untitled = read.found.some((f) => f.hit.slot === "repeat");
    return { ...literal, title: unescape(line), ...(untitled && { untitled: true as const }) };
  }

  const sorted = [...read.found].sort((a, b) => a.at - b.at);
  const hits = sorted.map((f) => f.hit);
  const pick = <S extends Hit["slot"]>(slot: S) => hits.find((h): h is Extract<Hit, { slot: S }> => h.slot === slot);
  const [repeat, end, time, length] = [pick("repeat"), pick("end"), pick("time"), pick("length")];
  const [soon, due, area] = [pick("soon"), pick("due"), pick("area")];
  // An "@name" left at the title's edge was meant as an area and matched none.
  const edge = areas ? [tokens[read.hi - 1], tokens[read.lo]].find((t) => /^@[^@\s]/.test(t.text)) : undefined;
  let day = pick("day")?.day ?? null;
  let cadence = repeat?.cadence;
  // "weekly review friday 4pm": a weekly repeat on no weekday and a plain weekday is that weekday every week.
  if (cadence?.freq === "weekly" && cadence.byDay.length === 0 && day?.kind === "weekday" && !day.next && !pick("day")?.starting) {
    cadence = { ...cadence, byDay: [ruleDay(day.weekday)] };
    day = null;
  }
  const title = unescape(line.slice(tokens[read.lo].from, tokens[read.hi - 1].to));
  // A lone "weekly" opening the line with nothing else read could have been a name, so the preview says how to keep it.
  const lead = sorted.find((f) => f.hit.slot === "repeat");
  const onlyLead = lead && lead.hit.slot === "repeat" && lead.hit.adverb && lead.at < read.lo && hits.every((h) => h.slot === "repeat" || h.slot === "tag");
  return {
    title,
    day,
    time: time ? { start: time.start, length: time.length ?? length?.minutes ?? null } : null,
    tags: firstSpellings(hits.flatMap((h) => (h.slot === "tag" ? [h.name] : []))),
    ...(soon && { soon: { after: soon.after, length: length?.minutes ?? null } }),
    ...(due && { due: due.day }),
    ...(area && { area: area.area }),
    ...(edge && { noArea: edge.text.slice(1) }),
    ...(cadence && { repeat: { ...cadence, end: end?.end ?? { kind: "never" } } }),
    ...(onlyLead && { quoteToKeep: line.slice(tokens[lead.at].from, tokens[read.hi - 1].to) }),
  };
}

/** Each tag once, as a tag's name is the same in any case, in its first spelling. */
function firstSpellings(names: readonly TagName[]): TagName[] {
  const byKey = new Map<string, TagName>();
  for (const name of names) if (!byKey.has(tagKey(name))) byKey.set(tagKey(name), name);
  return [...byKey.values()];
}

const weekdayOf = (date: LocalDate) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The first date on or after `from` that is this day of this month; 29 February waits for a leap year. */
function nextDate(month: number, day: number, from: LocalDate): LocalDate {
  const year = Number(from.slice(0, 4));
  for (let y = year; y < year + 8; y++) {
    const on = parseLocalDate(`${y}-${pad(month)}-${pad(day)}`);
    if (on && on >= from) return on;
  }
  return from;
}

/**
 * The date a typed day names, counted from `today`. A weekday is the next one,
 * today included; "next" is that day in next week. A day and month with no
 * year is the next one, today included.
 */
export function dayOf(word: DayWord, today: LocalDate, weekStart: WeekStart = WEEK_STARTS_ON): LocalDate {
  switch (word.kind) {
    case "in":
      return addDays(today, word.days);
    case "on":
      return word.date;
    case "weekday": {
      const from = word.next ? addDays(weekOf(today, weekStart)[0], WEEK_LENGTH) : today;
      return addDays(from, (word.weekday - weekdayOf(from) + WEEK_LENGTH) % WEEK_LENGTH);
    }
    case "date":
      return nextDate(word.month, word.day, today);
    case "nextWeek":
      return addDays(weekOf(today, weekStart)[0], WEEK_LENGTH);
    case "weekend": {
      // On a Sunday the weekend is under way, so "this weekend" is today and "next" is the coming Saturday.
      const saturday = addDays(today, weekdayOf(today) === 0 ? -1 : (6 - weekdayOf(today)) % WEEK_LENGTH);
      if (word.next) return addDays(saturday, WEEK_LENGTH);
      return saturday < today ? today : saturday;
    }
    case "months":
      return addMonths(today, word.months);
    case "nextMonth":
      return addMonths(`${today.slice(0, 8)}01` as LocalDate, 1);
    case "monthEnd":
      return addDays(addMonths(`${today.slice(0, 8)}01` as LocalDate, 1), -1);
  }
}

/**
 * A typed day in words, before it is pinned to a date. Given `today` it names the date instead for the days that
 * need a calendar to place ("next week", "20/12", "end of month"), with the month spelled out and the year when it is not this one.
 */
export function dayWordText(word: DayWord, weekStart: WeekStart = WEEK_STARTS_ON, today?: LocalDate): string {
  if (today && word.kind !== "in" && word.kind !== "weekday" && word.kind !== "on") {
    const on = dayOf(word, today, weekStart);
    return on === today ? "today" : on === addDays(today, 1) ? "tomorrow" : formatDayIn(on, today);
  }
  switch (word.kind) {
    case "in":
      return word.days === 0 ? "today" : word.days === 1 ? "tomorrow" : `in ${word.days} days`;
    case "on":
      return formatDayHeading(word.date);
    case "weekday": {
      const name = WEEKDAYS[word.weekday];
      return `${word.next ? "next " : ""}${name[0].toUpperCase()}${name.slice(1)}`;
    }
    case "date":
      return `${word.day} ${monthName(word.month)}`;
    case "nextWeek":
      return `${capitalise(WEEKDAYS[weekStart])} next week`;
    case "weekend":
      return word.next ? "next weekend" : "this weekend";
    case "months":
      return word.months === 1 ? "in 1 month" : `in ${word.months} months`;
    case "nextMonth":
      return "the 1st of next month";
    case "monthEnd":
      return "the end of the month";
  }
}

/** The date `months` later, its day kept or pulled back to the month's last: 31 January plus one month is 28 or 29 February. */
function addMonths(date: LocalDate, months: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(0);
  first.setUTCFullYear(y, m - 1 + months, 1);
  const last = new Date(0);
  last.setUTCFullYear(first.getUTCFullYear(), first.getUTCMonth() + 1, 0);
  first.setUTCDate(Math.min(d, last.getUTCDate()));
  return first.toISOString().slice(0, 10) as LocalDate;
}

function monthEnd(month: number, from: LocalDate): LocalDate {
  const year = Number(from.slice(0, 4));
  const end = (y: number) => addDays(addMonths(`${y}-${pad(month)}-01` as LocalDate, 1), -1);
  return end(year) >= from ? end(year) : end(year + 1);
}

/** A typed end as a rule's end, counted from the first day; null when it is not a date Axiis plans on. */
function ruleEnd(end: RepeatEnd, first: LocalDate, today: LocalDate, weekStart: WeekStart): RuleEnd | null {
  const until = (on: LocalDate | null): RuleEnd | null => (on && parseLocalDate(on) ? { kind: "until", on } : null);
  switch (end.kind) {
    case "never":
    case "count":
      return end;
    case "for": {
      const after = end.unit === "day" ? addDays(first, end.n) : end.unit === "week" ? addDays(first, end.n * WEEK_LENGTH) : addMonths(first, end.unit === "month" ? end.n : end.n * 12);
      return until(addDays(after, -1));
    }
    case "until":
      return until(end.day.kind === "date" ? nextDate(end.day.month, end.day.day, first) : dayOf(end.day, today, weekStart));
    case "monthEnd":
      return until(monthEnd(end.month ?? Number(first.slice(5, 7)), first));
  }
}

/** A series a capture makes: its first date and its rule. */
export type CaptureSeries = { first: LocalDate; rule: Rule };

/** The moment a line is read: today's date, and whether a time of day today has already come. */
export type Moment = {
  today: LocalDate;
  begun: (minutes: number) => boolean;
  /** Where "in 2 hours" lands, see `soonAt`. */
  soon?: (after: number) => { on: LocalDate; start: number };
};

/** How finely a start counted from now is placed: the Score's quarter hour. */
const SOON_SNAP = 15;

/**
 * Where a start `after` minutes from `now` lands: the wall clock of that
 * instant in `timeZone`, moved up to the quarter hour so it is never sooner
 * than asked, on the day that instant falls on (tomorrow, past midnight). The
 * minutes are counted in real time, so across a clock change "in 2 hours" is
 * still two hours away.
 */
export function soonAt(after: number, now: Date, timeZone: string): { on: LocalDate; start: number } {
  const at = new Date(now.getTime() + after * 60_000);
  const on = toLocalDate(at, timeZone);
  const start = Math.ceil(wallMinutes(at, timeZone) / SOON_SNAP) * SOON_SNAP;
  return start >= DAY_MINUTES ? { on: addDays(on, 1), start: 0 } : { on, start };
}

/**
 * The moment `now` is in `timeZone`. A time has come once its instant today is
 * at or before `now`, found with `instantAt`, so a day the clocks change reads
 * that day's own clock.
 */
export function momentAt(now: Date, timeZone: string): Moment {
  const today = toLocalDate(now, timeZone);
  return {
    today,
    begun: (minutes) => instantAt(today, minutes, timeZone).getTime() <= now.getTime(),
    soon: (after) => soonAt(after, now, timeZone),
  };
}

/** The moment on this device, for a preview as the line is typed; the server reads its own when the line is sent. */
export function momentHere(): Moment {
  return momentAt(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * True when a repeating line's first day passes over today: it has a time,
 * that time has come today, and the line did not name today itself.
 */
export function passesToday(c: CaptureText, moment: Moment): boolean {
  return c.repeat !== undefined && c.time !== null && !(c.day?.kind === "in" && c.day.days === 0) && moment.begun(c.time.start);
}

/**
 * Pins a typed repeat to dates. The first day is the first one on or after
 * `from` that the repeat falls on. When that is today and `passToday` is set
 * (the line's time has already come, see `passesToday`), it is the next day
 * the repeat falls on instead: the next of its weekdays, tomorrow for a daily
 * one, this day next week, month or year for one that names no weekday. A
 * weekly repeat on one weekday is stored as a plain weekly rule on that day,
 * the form the panel's menu names. Null when it would end before it starts
 * or past the dates Axiis plans on.
 */
export function seriesFor(repeat: RepeatWords, from: LocalDate, today: LocalDate, passToday = false, weekStart: WeekStart = WEEK_STARTS_ON): CaptureSeries | null {
  const byDay = repeat.freq === "weekly" ? repeat.byDay : [];
  const falls = (day: LocalDate) => byDay.length === 0 || byDay.includes(ruleDay(weekdayOf(day)));
  let first = from;
  while (!falls(first)) first = addDays(first, 1);
  if (passToday && first === today) {
    if (repeat.freq === "monthly") first = addMonths(today, 1);
    else if (repeat.freq === "yearly") first = addMonths(today, 12);
    else first = addDays(today, repeat.freq === "weekly" && byDay.length === 0 ? WEEK_LENGTH : 1);
    while (!falls(first)) first = addDays(first, 1);
  }
  const end = ruleEnd(repeat.end, first, today, weekStart);
  if (!end || (end.kind === "until" && end.on < first)) return null;
  const { interval } = repeat;
  const rule: Rule =
    repeat.freq === "weekly"
      ? { freq: "weekly", interval, byDay: byDay.length === 1 ? [] : [...byDay], end }
      : { freq: repeat.freq, interval, end };
  return { first, rule };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const timesWords = (count: number) => (count === 1 ? "once" : `${count} times`);

/** How a series repeats, mid-sentence: "every Tuesday", "every weekday, 10 times", "every day, until Sunday 20 December". */
export function seriesWords(rule: Rule, first: LocalDate, today: LocalDate): string {
  const cadence = cadenceWords({ freq: rule.freq, interval: rule.interval, byDay: rule.freq === "weekly" ? rule.byDay : [] }, ruleDay(weekdayOf(first)));
  const end = rule.end.kind === "count" ? timesWords(rule.end.count) : rule.end.kind === "until" ? `until ${formatDayIn(rule.end.on, today)}` : null;
  return end ? `${cadence}, ${end}` : cadence;
}

function endWords(end: RepeatEnd, monthEndDay: string | null): string | null {
  switch (end.kind) {
    case "never":
      return null;
    case "count":
      return timesWords(end.count);
    case "for":
      return `for ${end.n} ${end.unit}${end.n === 1 ? "" : "s"}`;
    case "until":
      return `until ${dayWordText(end.day)}`;
    case "monthEnd":
      if (monthEndDay) return `until ${monthEndDay}`;
      return `until the end of ${end.month === null ? "the month" : monthName(end.month)}`;
  }
}

/**
 * How a repeat reads, capitalised, with its first day when that needs saying:
 * the one typed ("starting tomorrow"), or, given the `moment`, the next day it
 * falls on when its time today has passed. Given the moment, a weekly repeat
 * that names no weekday names today's.
 */
function repeatPreview(c: CaptureText & { repeat: RepeatWords }, moment: Moment | undefined): string {
  const typedDay = c.day?.kind === "weekday" ? ruleDay(c.day.weekday) : null;
  if (!moment) return `${capitalise(cadenceWords(c.repeat, typedDay))}${c.day ? ` starting ${dayWordText(c.day, c.weekStart)}` : ""}`;
  const { today } = moment;
  const from = c.day ? dayOf(c.day, today, c.weekStart) : today;
  const passed = passesToday(c, moment);
  const series = seriesFor(c.repeat, from, today, passed, c.weekStart);
  const first = series?.first ?? from;
  const cadence = capitalise(cadenceWords(c.repeat, typedDay ?? ruleDay(weekdayOf(first))));
  const movedOff = passed && seriesFor(c.repeat, from, today, false, c.weekStart)?.first === today && first !== today;
  if (movedOff) return `${cadence} starting ${first === addDays(today, 1) ? "tomorrow" : formatDayIn(first, today)}`;
  if (c.day) return `${cadence} starting ${dayWordText(c.day, c.weekStart, today)}`;
  // "Every other Friday" could be either of two, so it says which it starts on.
  return c.repeat.interval > 1 ? `${cadence}, from ${shortDay(first, today)}` : cadence;
}

/** "14 Nov", with the year when it is not this one. */
function shortDay(on: LocalDate, today: LocalDate): string {
  const year = yearOfDate(on) === yearOfDate(today) ? "" : ` ${yearOfDate(on)}`;
  return `${Number(on.slice(8, 10))} ${monthName(Number(on.slice(5, 7))).slice(0, 3)}${year}`;
}

/** "31 December", with the year when it is not this one. */
function dayMonth(on: LocalDate, today: LocalDate | null): string {
  const year = today && yearOfDate(on) !== yearOfDate(today) ? ` ${yearOfDate(on)}` : "";
  return `${Number(on.slice(8, 10))} ${monthName(Number(on.slice(5, 7)))}${year}`;
}

const yearOfDate = (date: LocalDate) => date.slice(0, 4);

/** The last day a repeat that runs to a month's end stops on, when it is known without a year or from the moment. */
function monthEndOn(c: CaptureText & { repeat: RepeatWords }, month: number | null, moment: Moment | undefined): LocalDate | null {
  if (moment) {
    const { today } = moment;
    const end = seriesFor(c.repeat, c.day ? dayOf(c.day, today, c.weekStart) : today, today, passesToday(c, moment), c.weekStart)?.rule.end;
    return end?.kind === "until" ? end.on : null;
  }
  // February's last day needs a year; any other month's is the same every year.
  return month === null || month === 2 ? null : monthEnd(month, "2026-01-01" as LocalDate);
}

/**
 * What a line will do, for a preview under the field before it is sent, or
 * null when it is all title. Given the `moment` it is read at, a repeat whose
 * time today has passed says the later day it starts on.
 */
export function previewWords(c: CaptureText, clock: Clock, moment?: Moment | { today: LocalDate }): string | null {
  if (c.untitled) return `Add what to do: “${c.title}” alone has no title`;
  const full = moment && "begun" in moment ? moment : undefined;
  const today = moment?.today;
  const soon = c.soon ? soonWords(c.soon, clock, full) : null;
  const day = c.repeat
    ? repeatPreview({ ...c, repeat: c.repeat }, full)
    : c.day
      ? dayWordText(c.day, c.weekStart, today)
      : c.time
        ? "today"
        : null;
  const time = c.time
    ? c.time.length === null
      ? formatMinutes(c.time.start, clock)
      : `${formatMinutes(c.time.start, clock)} to ${formatMinutes(c.time.start + c.time.length, clock)}`
    : null;
  const repeat = c.repeat;
  const lastOn = repeat?.end.kind === "monthEnd" ? monthEndOn({ ...c, repeat }, repeat.end.month, full) : null;
  const end = repeat ? endWords(repeat.end, lastOn && dayMonth(lastOn, full?.today ?? null)) : null;
  const due = c.due ? `due ${dayWordText(c.due, c.weekStart, today)}` : null;
  const area = c.area ? `@${c.area.name}` : null;
  // An "@name" that matched nothing is said last, so it is never taken for something read.
  const noArea = c.noArea === undefined ? null : `no area named “${c.noArea}”, so it stays in the title`;
  const parts = [soon, day, time, end, due, area, ...c.tags.map((t) => `#${t}`), noArea].filter((p) => p !== null);
  if (!parts.length) return null;
  const said = parts.length === 1 && noArea ? capitalise(noArea) : parts.join(", ");
  return c.quoteToKeep ? `${said} (in quotes, “${c.quoteToKeep}” stays a title)` : said;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "today, 14:15 to 14:45" once the moment is known; before that, "in 2 hours". */
function soonWords(soon: CaptureSoon, clock: Clock, moment: Moment | undefined): string {
  const at = moment?.soon?.(soon.after);
  if (!moment || !at) {
    const after = soon.after % 60 === 0 ? plural(soon.after / 60, "hour") : plural(soon.after, "minute");
    return `in ${after}${soon.length === null ? "" : ` for ${plural(soon.length, "minute")}`}`;
  }
  const day = at.on === moment.today ? "today" : at.on === addDays(moment.today, 1) ? "tomorrow" : formatDayIn(at.on, moment.today);
  const end = soon.length === null ? "" : ` to ${formatMinutes(at.start + soon.length, clock)}`;
  return `${day}, ${formatMinutes(at.start, clock)}${end}`;
}

/** "#a", "#a and #b", "#a, #b and #c". */
export function tagList(tags: readonly string[]): string {
  const names = tags.map((t) => `#${t}`);
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type Captured = Extract<CaptureResult, { ok: true }>;

/** Lines the capture field's placeholder turns through on an account's first day, each one real capture syntax. */
export const CAPTURE_EXAMPLES = ["dentist tomorrow 9:00 #health", "call Sam friday 14:00 for 30m", "buy milk", "gym every tuesday 7:30 to 9"] as const;

/** Above the capture field on an account's first day. */
export const CAPTURE_LEAD = "Type one thing you have to do. Add a day or a time and it goes on that day, at that time.";

/**
 * What a status line says once a capture has saved: in the capture field,
 * which sits above the tray, or in the palette, which can be opened anywhere.
 */
export function capturedLine(result: Captured, where: "field" | "palette", clock: Clock): string {
  if (result.type === "checklist") return "Captured. It is open, ready for its lines.";
  const tags = result.tags.length ? ` with ${tagList(result.tags)}` : "";
  const what = where === "palette" ? `Captured “${result.title}”` : "Captured";
  const { landed } = result;
  const time = landed?.time && landedTime(landed.time, clock);
  const plan = landed && (time ? `${landed.day}, ${time.start}${time.end ? ` to ${time.end}` : ""}` : landed.day);
  const line = plan
    ? `${where === "palette" ? `${what}. ` : ""}${landed.repeats ? "Starts" : "Planned for"} ${plan}${tags ? `,${tags}` : ""}.`
    : `${what}${tags}. It is in the Inbox${where === "palette" ? "" : ", below"}.`;
  const repeats = landed?.repeats ? ` Repeats ${landed.repeats}.` : "";
  return line + repeats + filedLine(result) + missedLine(result);
}

/** The due date and the area a capture took, each as its own short sentence. */
function filedLine({ due, area }: Captured): string {
  return `${due ? ` Due ${due}.` : ""}${area ? ` In ${area}.` : ""}`;
}

function landedTime(time: NonNullable<Landed["time"]>, clock: Clock): { start: string; end: string | null } {
  return { start: formatMinutes(time.start, clock), end: time.end === null ? null : formatMinutes(time.end, clock) };
}

function missedLine({ missed }: Captured): string {
  return missed.length ? ` ${missed.length === 1 ? "The tag" : "The tags"} ${tagList(missed)} did not save.` : "";
}

/**
 * The status line after an account's first capture ever: what capture
 * understood, as a sentence, and a link to where the item went. A day's link
 * names that day; a capture with no day goes to the Inbox.
 */
export function firstCapturedLine(result: Captured, clock: Clock): { text: string; link: { href: string; label: string } } {
  const { landed } = result;
  const title = capitalise(result.title);
  const tags = result.tags.length ? `, tagged ${tagList(result.tags)}` : "";
  if (!landed) return { text: `${title} is in the Inbox, with no day yet${tags}.${filedLine(result)}${missedLine(result)}`, link: { href: "/inbox", label: "See the Inbox" } };
  const day = landed.day === "today" || landed.day === "tomorrow" ? landed.day : `on ${landed.day}`;
  const at = landed.time && landedTime(landed.time, clock);
  const time = !at ? ", at any time" : at.end ? ` from ${at.start} to ${at.end}` : ` at ${at.start}`;
  const repeats = landed.repeats ? `, and repeats ${landed.repeats}` : "";
  return {
    text: `${title} is ${day}${time}${repeats}${tags}.${filedLine(result)}${missedLine(result)}`,
    link: { href: landed.day === "today" ? "/today" : `/day/${landed.on}`, label: `See ${landed.day}` },
  };
}
