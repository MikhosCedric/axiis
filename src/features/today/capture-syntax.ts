import type { LocalDate } from "@/domain/item";
import { MAX_COUNT, type Rule, type RuleEnd } from "@/domain/recurrence";
import { parseTagName, tagKey, type TagName } from "@/domain/tag";
import { WEEK_LENGTH, weekOf } from "@/features/week/week-of";
import { addDays, instantAt, parseLocalDate, toLocalDate } from "@/lib/dates";
import type { CaptureResult, Landed } from "./commands";
import { formatMinutes, type Clock } from "@/lib/clock";
import { cadenceHit, cadenceWords, dateWords, monthName, monthWord, ruleDay, type Cadence } from "./capture-repeat";
import { formatDayHeading, formatDayIn } from "./format";

/** A day as typed, before it is pinned to a date: that needs today, which only the server knows for sure. */
export type DayWord =
  | { kind: "in"; days: number }
  | { kind: "weekday"; weekday: number; next: boolean }
  | { kind: "on"; date: LocalDate }
  /** A day and month with no year ("20 dec"): the next one from the day it is counted from. Read only after "until" or "starting". */
  | { kind: "date"; month: number; day: number };

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
  repeat?: RepeatWords;
  /** Set when a lone "weekly" or "daily" opening the line was read as the repeat and nothing else was: the words that, in quotes, would stay a title ("weekly review"). */
  quoteToKeep?: string;
  /** Set when the line is all title only because it is a repeat with nothing to name it ("every sunday"). */
  untitled?: true;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const CONNECTORS = new Set(["on", "next", "in", "at", "for", "by"]);
/**
 * Words that tie what follows them into the title. A phrase is never read
 * right after one, so "Groceries for Sunday" keeps its Sunday. Phrases that
 * start with one of them ("on friday", "by tomorrow", "at 9", "in 3 days",
 * "next friday", "for 45m", "until 20 dec") are read whole, preposition included.
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
]);
const DAY_MINUTES = 24 * 60;
/** The most words one phrase spans: "every 2 weeks on mon, wed and fri", "until the end of june". */
const MAX_WORDS = 8;

type Hit =
  | { slot: "day"; day: DayWord; starting: boolean }
  | { slot: "time"; start: number; length: number | null; bare: boolean }
  | { slot: "length"; minutes: number }
  | { slot: "tag"; name: TagName }
  | { slot: "repeat"; cadence: Cadence; adverb: boolean }
  | { slot: "end"; end: RepeatEnd };

type Token = { text: string; low: string; from: number; to: number };

function dayHit(p: string): DayWord | null {
  if (/^(?:by )?today$/.test(p)) return { kind: "in", days: 0 };
  if (/^(?:by )?tomorrow$/.test(p)) return { kind: "in", days: 1 };
  let m = /^(?:on |by )?(next )?([a-z]+)$/.exec(p);
  if (m && WEEKDAYS.includes(m[2])) return { kind: "weekday", weekday: WEEKDAYS.indexOf(m[2]), next: m[1] !== undefined };
  m = /^(?:on |by )?(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (m) {
    const date = parseLocalDate(m[1]);
    return date ? { kind: "on", date } : null;
  }
  m = /^in (\d{1,3}|a|one) (days?|weeks?)$/.exec(p);
  if (m) {
    const n = /\d/.test(m[1]) ? Number(m[1]) : 1;
    return { kind: "in", days: m[2].startsWith("week") ? n * WEEK_LENGTH : n };
  }
  return null;
}

/** A day word, or a date by day and month ("20 dec", "december 20th 2027"), as "until" and "starting" take them. */
function dateHit(p: string): DayWord | null {
  const word = dayHit(p);
  if (word) return word;
  const date = dateWords(p.replace(/^on /, ""));
  if (!date) return null;
  if (date.year === null) return { kind: "date", month: date.month, day: date.day };
  const on = parseLocalDate(`${date.year}-${pad(date.month)}-${pad(date.day)}`);
  return on ? { kind: "on", date: on } : null;
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

function lengthHit(p: string): number | null {
  const m = /^for (?:(\d{1,2}) ?(?:h|hr|hrs|hour|hours))? ?(?:(\d{1,4}) ?(?:m|min|mins|minute|minutes))?$/.exec(p);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
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

function hitAt(tokens: readonly Token[], from: number, to: number): Hit | null {
  const words = tokens.slice(from, to);
  if (words.length === 1 && /^#[^#\s]/.test(words[0].text)) {
    const name = parseTagName(words[0].text);
    return name ? { slot: "tag", name } : null;
  }
  const p = words.map((w) => w.low).join(" ");
  const day = dayHit(p);
  if (day) return { slot: "day", day, starting: false };
  const time = timeHit(p);
  if (time) return { slot: "time", ...time };
  const length = lengthHit(p);
  if (length !== null) return { slot: "length", minutes: length };
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

/** True when the word before `at` is a preposition, so a phrase starting at `at` belongs to the title. */
const dangles = (tokens: readonly Token[], at: number) => at > 0 && PREPOSITIONS.has(tokens[at - 1].low);

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
/** `length`: a length may be read. `repeatOnly`: an end or a "starting" day, which mean something only beside a repeat. */
type Allow = { length: boolean; repeatOnly: boolean };

/**
 * Peels recognised phrases off the end of the line, then off its start, and
 * stops at the first word on each side that is not one. Each of day, time,
 * length, repeat and end is taken once.
 */
function scan(tokens: readonly Token[], allow: Allow): Scan {
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
  };

  fromEnd: while (hi > lo) {
    for (let n = Math.min(MAX_WORDS, hi - lo); n >= 1; n--) {
      const hit = hitAt(tokens, hi - n, hi);
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
      const hit = hitAt(tokens, lo, lo + n);
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
export function parseCapture(text: string): CaptureText {
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
  const allow: Allow = { length: true, repeatOnly: true };
  let read = scan(tokens, allow);
  for (;;) {
    const has = (slot: Hit["slot"]) => read.found.some((f) => f.hit.slot === slot);
    const lengthAlone = allow.length && has("length") && !has("time");
    const repeatOnlyAlone =
      allow.repeatOnly && !has("repeat") && read.found.some((f) => f.hit.slot === "end" || (f.hit.slot === "day" && f.hit.starting));
    if (!lengthAlone && !repeatOnlyAlone) break;
    if (lengthAlone) allow.length = false;
    if (repeatOnlyAlone) allow.repeatOnly = false;
    read = scan(tokens, allow);
  }
  if (read.lo >= read.hi) {
    const untitled = read.found.some((f) => f.hit.slot === "repeat");
    return { ...literal, title: unescape(line), ...(untitled && { untitled: true as const }) };
  }

  const sorted = [...read.found].sort((a, b) => a.at - b.at);
  const hits = sorted.map((f) => f.hit);
  const pick = <S extends Hit["slot"]>(slot: S) => hits.find((h): h is Extract<Hit, { slot: S }> => h.slot === slot);
  const [repeat, end, time, length] = [pick("repeat"), pick("end"), pick("time"), pick("length")];
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
export function dayOf(word: DayWord, today: LocalDate): LocalDate {
  switch (word.kind) {
    case "in":
      return addDays(today, word.days);
    case "on":
      return word.date;
    case "weekday": {
      const from = word.next ? addDays(weekOf(today)[0], WEEK_LENGTH) : today;
      return addDays(from, (word.weekday - weekdayOf(from) + WEEK_LENGTH) % WEEK_LENGTH);
    }
    case "date":
      return nextDate(word.month, word.day, today);
  }
}

export function dayWordText(word: DayWord): string {
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
function ruleEnd(end: RepeatEnd, first: LocalDate, today: LocalDate): RuleEnd | null {
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
      return until(end.day.kind === "date" ? nextDate(end.day.month, end.day.day, first) : dayOf(end.day, today));
    case "monthEnd":
      return until(monthEnd(end.month ?? Number(first.slice(5, 7)), first));
  }
}

/** A series a capture makes: its first date and its rule. */
export type CaptureSeries = { first: LocalDate; rule: Rule };

/** The moment a line is read: today's date, and whether a time of day today has already come. */
export type Moment = { today: LocalDate; begun: (minutes: number) => boolean };

/**
 * The moment `now` is in `timeZone`. A time has come once its instant today is
 * at or before `now`, found with `instantAt`, so a day the clocks change reads
 * that day's own clock.
 */
export function momentAt(now: Date, timeZone: string): Moment {
  const today = toLocalDate(now, timeZone);
  return { today, begun: (minutes) => instantAt(today, minutes, timeZone).getTime() <= now.getTime() };
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
export function seriesFor(repeat: RepeatWords, from: LocalDate, today: LocalDate, passToday = false): CaptureSeries | null {
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
  const end = ruleEnd(repeat.end, first, today);
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
  if (!moment) return `${capitalise(cadenceWords(c.repeat, typedDay))}${c.day ? ` starting ${dayWordText(c.day)}` : ""}`;
  const { today } = moment;
  const from = c.day ? dayOf(c.day, today) : today;
  const passed = passesToday(c, moment);
  const series = seriesFor(c.repeat, from, today, passed);
  const first = series?.first ?? from;
  const cadence = capitalise(cadenceWords(c.repeat, typedDay ?? ruleDay(weekdayOf(first))));
  const movedOff = passed && seriesFor(c.repeat, from, today)?.first === today && first !== today;
  if (movedOff) return `${cadence} starting ${first === addDays(today, 1) ? "tomorrow" : formatDayIn(first, today)}`;
  if (c.day) return `${cadence} starting ${dayWordText(c.day)}`;
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
    const end = seriesFor(c.repeat, c.day ? dayOf(c.day, today) : today, today, passesToday(c, moment))?.rule.end;
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
export function previewWords(c: CaptureText, clock: Clock, moment?: Moment): string | null {
  if (c.untitled) return `Add what to do: “${c.title}” alone has no title`;
  const day = c.repeat
    ? repeatPreview({ ...c, repeat: c.repeat }, moment)
    : c.day
      ? dayWordText(c.day)
      : c.time
        ? "today"
        : null;
  const time = c.time
    ? c.time.length === null
      ? formatMinutes(c.time.start, clock)
      : `${formatMinutes(c.time.start, clock)} to ${formatMinutes(c.time.start + c.time.length, clock)}`
    : null;
  const repeat = c.repeat;
  const lastOn = repeat?.end.kind === "monthEnd" ? monthEndOn({ ...c, repeat }, repeat.end.month, moment) : null;
  const end = repeat ? endWords(repeat.end, lastOn && dayMonth(lastOn, moment?.today ?? null)) : null;
  const parts = [day, time, end, ...c.tags.map((t) => `#${t}`)].filter((p) => p !== null);
  if (!parts.length) return null;
  const said = parts.join(", ");
  return c.quoteToKeep ? `${said} (in quotes, “${c.quoteToKeep}” stays a title)` : said;
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
export const CAPTURE_LEAD = "Type one thing you have to do. Add a day or a time and it lands on its line.";

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
  return line + repeats + missedLine(result);
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
  if (!landed) return { text: `${title} is in the Inbox, with no day yet${tags}.${missedLine(result)}`, link: { href: "/inbox", label: "See the Inbox" } };
  const day = landed.day === "today" || landed.day === "tomorrow" ? landed.day : `on ${landed.day}`;
  const at = landed.time && landedTime(landed.time, clock);
  const time = !at ? ", at any time" : at.end ? ` from ${at.start} to ${at.end}` : ` at ${at.start}`;
  const repeats = landed.repeats ? `, and repeats ${landed.repeats}` : "";
  return {
    text: `${title} is ${day}${time}${repeats}${tags}.${missedLine(result)}`,
    link: { href: landed.day === "today" ? "/today" : `/day/${landed.on}`, label: `See ${landed.day}` },
  };
}
