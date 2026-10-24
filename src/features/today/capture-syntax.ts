import type { LocalDate } from "@/domain/item";
import { parseTagName, tagKey, type TagName } from "@/domain/tag";
import { WEEK_LENGTH, weekOf } from "@/features/week/model";
import { addDays, parseLocalDate } from "@/lib/dates";
import type { CaptureResult, Landed } from "./commands";
import { formatMinutes, type Clock } from "@/lib/clock";
import { formatDayHeading } from "./format";

/** A day as typed, before it is pinned to a date: that needs today, which only the server knows for sure. */
export type DayWord =
  | { kind: "in"; days: number }
  | { kind: "weekday"; weekday: number; next: boolean }
  | { kind: "on"; date: LocalDate };

/** A start in minutes past local midnight, and the length only when one was typed. */
export type CaptureTime = { start: number; length: number | null };

/** What capture understood in a line of text. Anything not understood stays in the title. */
export type CaptureText = {
  title: string;
  day: DayWord | null;
  time: CaptureTime | null;
  tags: TagName[];
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const CONNECTORS = new Set(["on", "next", "in", "at", "for", "by"]);
/**
 * Words that tie what follows them into the title. A phrase is never read
 * right after one, so "Groceries for Sunday" keeps its Sunday. Phrases that
 * start with one of them ("on friday", "by tomorrow", "at 9", "in 3 days",
 * "next friday", "for 45m") are read whole, preposition included.
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
]);
const DAY_MINUTES = 24 * 60;
/** The most words one phrase spans: "in 3 days", "at 9 pm", "for 1h 30m". */
const MAX_WORDS = 3;

type Hit =
  | { slot: "day"; day: DayWord }
  | { slot: "time"; start: number; bare: boolean }
  | { slot: "length"; minutes: number }
  | { slot: "tag"; name: TagName };

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

const clock = (h: number, m: number) => (h < 24 && m < 60 ? h * 60 + m : null);

/** A clock time. `bare` is a plain hour or four digits, which mean a time only right after a day. */
function timeHit(p: string): { start: number; bare: boolean } | null {
  const at = p.startsWith("at ");
  const t = at ? p.slice(3) : p;
  let m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) {
    const start = clock(Number(m[1]), Number(m[2]));
    return start === null ? null : { start, bare: false };
  }
  m = /^(\d{1,2})(?::(\d{2}))? ?(am|pm)$/.exec(t);
  if (m) {
    const h = Number(m[1]);
    const start = h >= 1 && h <= 12 ? clock((h % 12) + (m[3] === "pm" ? 12 : 0), Number(m[2] ?? 0)) : null;
    return start === null ? null : { start, bare: false };
  }
  m = /^(\d{1,2})$/.exec(t) ?? /^(\d{2})(\d{2})$/.exec(t);
  if (m) {
    const start = clock(Number(m[1]), Number(m[2] ?? 0));
    return start === null ? null : { start, bare: !at };
  }
  return null;
}

function lengthHit(p: string): number | null {
  const m = /^for (?:(\d{1,2}) ?(?:h|hr|hrs|hour|hours))? ?(?:(\d{1,4}) ?(?:m|min|mins|minute|minutes))?$/.exec(p);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return minutes > 0 && minutes <= DAY_MINUTES ? minutes : null;
}

function hitAt(tokens: readonly Token[], from: number, to: number): Hit | null {
  const words = tokens.slice(from, to);
  if (words.length === 1 && /^#[^#\s]/.test(words[0].text)) {
    const name = parseTagName(words[0].text);
    return name ? { slot: "tag", name } : null;
  }
  const p = words.map((w) => w.low).join(" ");
  const day = dayHit(p);
  if (day) return { slot: "day", day };
  const time = timeHit(p);
  if (time) return { slot: "time", ...time };
  const length = lengthHit(p);
  return length === null ? null : { slot: "length", minutes: length };
}

/** True when the word before `at` is a preposition, so a phrase starting at `at` belongs to the title. */
const dangles = (tokens: readonly Token[], at: number) => at > 0 && PREPOSITIONS.has(tokens[at - 1].low);

/** True when a day phrase that would be read ends just before `end`, so a bare hour after it reads as a time. */
function dayEndsAt(tokens: readonly Token[], lo: number, end: number): boolean {
  for (let n = 1; n <= MAX_WORDS && end - n >= lo; n++) {
    if (hitAt(tokens, end - n, end)?.slot === "day" && !dangles(tokens, end - n)) return true;
  }
  return false;
}

type Scan = { lo: number; hi: number; found: { hit: Hit; at: number }[] };

/**
 * Peels recognised phrases off the end of the line, then off its start, and
 * stops at the first word on each side that is not one. Each of day, time and
 * length is taken once; a length only when `withLength`.
 */
function scan(tokens: readonly Token[], withLength: boolean): Scan {
  let lo = 0;
  let hi = tokens.length;
  const found: Scan["found"] = [];
  const taken = new Set<string>();
  const fits = (hit: Hit, afterDay: boolean) => {
    if (hit.slot === "tag") return true;
    if (taken.has(hit.slot)) return false;
    if (hit.slot === "length") return withLength;
    return hit.slot !== "time" || !hit.bare || afterDay;
  };
  const take = (hit: Hit, at: number) => {
    found.push({ hit, at });
    taken.add(hit.slot);
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
      if (hit && fits(hit, afterDay)) {
        take(hit, lo);
        afterDay = hit.slot === "day";
        lo += n;
        continue fromStart;
      }
    }
    break;
  }
  return { lo, hi, found };
}

/** Drops the backslash from a word that would otherwise be read as a day, time, length or tag. */
function unescape(title: string): string {
  return title.replace(/(^|\s)\\([^\s\\]\S*)/g, (whole, space: string, word: string) => {
    const token = { text: word, low: word.toLowerCase(), from: 0, to: word.length };
    return hitAt([token], 0, 1) || CONNECTORS.has(token.low) ? space + word : whole;
  });
}

/**
 * Reads a captured line: a day, a start time, a length and tags at its start
 * or end, as in "dentist tomorrow 9:00 #health". Only whole words are read,
 * and only from the edges inward, so a word that is not part of a phrase keeps
 * everything behind it in the title. A line in quotes, or a word after a
 * backslash, stays as typed. A line that would leave no title is all title.
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
  let read = scan(tokens, true);
  const has = (slot: Hit["slot"]) => read.found.some((f) => f.hit.slot === slot);
  if (has("length") && !has("time")) read = scan(tokens, false);
  if (read.lo >= read.hi) return { ...literal, title: unescape(line) };

  const hits = [...read.found].sort((a, b) => a.at - b.at).map((f) => f.hit);
  const day = hits.find((h) => h.slot === "day");
  const time = hits.find((h) => h.slot === "time");
  const length = hits.find((h) => h.slot === "length");
  return {
    title: unescape(line.slice(tokens[read.lo].from, tokens[read.hi - 1].to)),
    day: day?.day ?? null,
    time: time ? { start: time.start, length: length?.minutes ?? null } : null,
    tags: firstSpellings(hits.flatMap((h) => (h.slot === "tag" ? [h.name] : []))),
  };
}

/** Each tag once, as a tag's name is the same in any case, in its first spelling. */
function firstSpellings(names: readonly TagName[]): TagName[] {
  const byKey = new Map<string, TagName>();
  for (const name of names) if (!byKey.has(tagKey(name))) byKey.set(tagKey(name), name);
  return [...byKey.values()];
}

const weekdayOf = (date: LocalDate) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The date a typed day names, counted from `today`. A weekday is the next one, today included; "next" is that day in next week. */
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
  }
}

/** What a line will do, for a preview under the field before it is sent, or null when it is all title. */
export function previewWords(c: CaptureText, clock: Clock): string | null {
  const day = c.day ? dayWordText(c.day) : c.time ? "today" : null;
  const time = c.time
    ? c.time.length === null
      ? formatMinutes(c.time.start, clock)
      : `${formatMinutes(c.time.start, clock)} to ${formatMinutes(c.time.start + c.time.length, clock)}`
    : null;
  const parts = [day, time, ...c.tags.map((t) => `#${t}`)].filter((p) => p !== null);
  return parts.length ? parts.join(", ") : null;
}

/** "#a", "#a and #b", "#a, #b and #c". */
export function tagList(tags: readonly string[]): string {
  const names = tags.map((t) => `#${t}`);
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type Captured = Extract<CaptureResult, { ok: true }>;

/** Lines the capture field's placeholder turns through on an account's first day, each one real capture syntax. */
export const CAPTURE_EXAMPLES = ["dentist tomorrow 9:00 #health", "call Sam friday 14:00 for 30m", "buy milk"] as const;

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
    ? `${where === "palette" ? `${what}. ` : ""}Planned for ${plan}${tags ? `,${tags}` : ""}.`
    : `${what}${tags}. It is in the Inbox${where === "palette" ? "" : ", below"}.`;
  return line + missedLine(result);
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
  const title = result.title.charAt(0).toUpperCase() + result.title.slice(1);
  const tags = result.tags.length ? `, tagged ${tagList(result.tags)}` : "";
  if (!landed) return { text: `${title} is in the Inbox, with no day yet${tags}.${missedLine(result)}`, link: { href: "/inbox", label: "See the Inbox" } };
  const day = landed.day === "today" || landed.day === "tomorrow" ? landed.day : `on ${landed.day}`;
  const at = landed.time && landedTime(landed.time, clock);
  const time = !at ? ", at any time" : at.end ? ` from ${at.start} to ${at.end}` : ` at ${at.start}`;
  return {
    text: `${title} is ${day}${time}${tags}.${missedLine(result)}`,
    link: { href: landed.day === "today" ? "/today" : `/day/${landed.on}`, label: `See ${landed.day}` },
  };
}
