import type { LocalDate } from "./item";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MAX_INTERVAL = 99;
export const MAX_COUNT = 1000;

/** When a series stops: never, after its last occurrence on or before a date, or after a number of occurrences. */
export type RuleEnd = { kind: "never" } | { kind: "until"; on: LocalDate } | { kind: "count"; count: number };

/** Which of a month's weekdays: the first to the fourth, or -1 for the last. No fifth, since most months lack one. */
export const NTHS = [1, 2, 3, 4, -1] as const;
export type Nth = (typeof NTHS)[number];

/** One weekday of a month by its place: the second Tuesday, the last Friday. */
export type NthWeekday = { nth: Nth; day: Weekday };

/**
 * The allowlisted slice of RFC 5545 that Axiis repeats with. A weekly rule
 * names weekdays; an empty `byDay` repeats on the first occurrence's weekday.
 * A monthly rule repeats on the first occurrence's day of the month, or with
 * `onThe` on one weekday by its place in the month.
 */
export type Rule =
  | { freq: "weekly"; interval: number; byDay: Weekday[]; end: RuleEnd }
  | { freq: "monthly"; interval: number; onThe?: NthWeekday; end: RuleEnd }
  | { freq: "daily" | "yearly"; interval: number; end: RuleEnd };

export type Freq = Rule["freq"];

const FREQS: Record<string, Freq> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" };
const KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "UNTIL", "COUNT"]);
const MAX_LENGTH = 200;

function untilDate(raw: string): LocalDate | null {
  if (!/^\d{8}$/.test(raw)) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const t = new Date(0);
  t.setUTCFullYear(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8)));
  return t.toISOString().slice(0, 10) === iso ? (iso as LocalDate) : null;
}

/**
 * Parses a stored rule. Anything outside the allowlist (BYSETPOS, BYHOUR,
 * EXDATE, a time on UNTIL, an ordinal on a weekly rule, a fifth weekday) is null.
 */
export function parseRule(raw: string): Rule | null {
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;
  const parts = new Map<string, string>();
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    const key = part.slice(0, eq);
    if (!KEYS.has(key) || parts.has(key)) return null;
    parts.set(key, part.slice(eq + 1));
  }

  const freq = FREQS[parts.get("FREQ") ?? ""];
  if (!freq) return null;

  let interval = 1;
  const rawInterval = parts.get("INTERVAL");
  if (rawInterval !== undefined) {
    if (!/^[1-9]\d?$/.test(rawInterval)) return null;
    interval = Number(rawInterval);
  }

  let end: RuleEnd = { kind: "never" };
  const rawUntil = parts.get("UNTIL");
  const rawCount = parts.get("COUNT");
  if (rawUntil !== undefined && rawCount !== undefined) return null;
  if (rawUntil !== undefined) {
    const on = untilDate(rawUntil);
    if (!on) return null;
    end = { kind: "until", on };
  }
  if (rawCount !== undefined) {
    if (!/^[1-9]\d{0,3}$/.test(rawCount) || Number(rawCount) > MAX_COUNT) return null;
    end = { kind: "count", count: Number(rawCount) };
  }

  const rawByDay = parts.get("BYDAY");
  if (freq === "monthly") {
    if (rawByDay === undefined) return { freq, interval, end };
    const m = /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/.exec(rawByDay);
    return m ? { freq, interval, onThe: { nth: Number(m[1]) as Nth, day: m[2] as Weekday }, end } : null;
  }
  if (freq !== "weekly") return rawByDay === undefined ? { freq, interval, end } : null;
  const byDay: Weekday[] = [];
  if (rawByDay !== undefined) {
    for (const day of rawByDay.split(",")) {
      if (!(WEEKDAYS as readonly string[]).includes(day) || byDay.includes(day as Weekday)) return null;
      byDay.push(day as Weekday);
    }
  }
  return { freq, interval, byDay: sortWeekdays(byDay), end };
}

export function sortWeekdays(days: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.filter((d) => days.includes(d));
}

/** The canonical string the database's allowlist check accepts. */
export function serializeRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === "weekly" && rule.byDay.length > 0) parts.push(`BYDAY=${sortWeekdays(rule.byDay).join(",")}`);
  if (rule.freq === "monthly" && rule.onThe) parts.push(`BYDAY=${rule.onThe.nth}${rule.onThe.day}`);
  if (rule.end.kind === "until") parts.push(`UNTIL=${rule.end.on.replaceAll("-", "")}`);
  if (rule.end.kind === "count") parts.push(`COUNT=${rule.end.count}`);
  return parts.join(";");
}

const DAY_MS = 86_400_000;
function utcDay(year: number, month: number, day: number): Date {
  const t = new Date(0);
  t.setUTCFullYear(year, month - 1, day);
  return t;
}
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10) as LocalDate;

/**
 * The date of a weekday by its place in a month (`month` 1 to 12): the second
 * Tuesday of March 2026, the last Friday of February 2028. Plain calendar
 * arithmetic on dates with no clock, so no time zone or clock change touches it.
 */
export function nthWeekdayOn(year: number, month: number, { nth, day }: NthWeekday): LocalDate {
  const want = (WEEKDAYS.indexOf(day) + 1) % 7; // as getUTCDay counts, Sunday 0
  if (nth === -1) {
    const last = utcDay(year, month + 1, 0);
    return isoOf(last.getTime() - ((last.getUTCDay() - want + 7) % 7) * DAY_MS);
  }
  const first = utcDay(year, month, 1);
  return isoOf(first.getTime() + (((want - first.getUTCDay() + 7) % 7) + (nth - 1) * 7) * DAY_MS);
}

/** The first date on or after `from` that is the given weekday of its month. */
export function nextNthWeekday(onThe: NthWeekday, from: LocalDate): LocalDate {
  const [year, month] = from.split("-").map(Number);
  const here = nthWeekdayOn(year, month, onThe);
  return here >= from ? here : nthWeekdayOn(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, onThe);
}

/**
 * The places a date holds among its month's weekdays, as a rule can name them:
 * the 14th is a second, the 25th a fourth and often also the last, the 30th
 * only ever the last (a fifth is not a rule).
 */
export function nthsOf(date: LocalDate): Nth[] {
  const [year, month, day] = date.split("-").map(Number);
  const nths: Nth[] = [];
  const place = Math.ceil(day / 7);
  if (place <= 4) nths.push(place as Nth);
  if (day + 7 > utcDay(year, month + 1, 0).getUTCDate()) nths.push(-1);
  return nths;
}
