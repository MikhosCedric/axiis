import type { DayRange, LocalDate } from "@/domain/item";

const HOUR = 3_600_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The calendar date `now` falls on in `timeZone`. */
export function toLocalDate(now: Date, timeZone: string): LocalDate {
  const parts = dateFormatter(timeZone).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}` as LocalDate;
}

/** True when `instant` falls on `date` in `timeZone`. */
export function isSameDay(date: LocalDate, instant: Date, timeZone: string): boolean {
  return toLocalDate(instant, timeZone) === date;
}

// setUTCFullYear, unlike Date.UTC, does not map years 0..99 onto 1900..1999.
function utcCalendarDay(y: number, m: number, d: number): string {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t.toISOString().slice(0, 10);
}

/** The calendar date `days` after `date` (negative goes back). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return utcCalendarDay(y, m, d + days) as LocalDate;
}

/** Parse an untrusted `YYYY-MM-DD`, or null when it is malformed or not a real calendar date. */
export function parseLocalDate(raw: unknown): LocalDate | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return utcCalendarDay(y, m, d) === raw ? (raw as LocalDate) : null;
}

/**
 * First instant whose local date is not before `date`. A binary search over
 * instants stays correct where local midnight is skipped or repeated, which
 * offset arithmetic gets wrong.
 */
function startOf(date: LocalDate, timeZone: string): Date {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  // UTC offsets span -12h..+14h, so the boundary lies inside this window.
  let lo = utcMidnight - 15 * HOUR;
  let hi = utcMidnight + 15 * HOUR;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (toLocalDate(new Date(mid), timeZone) < date) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/** Half-open UTC range `[from, to)` covering `date` in `timeZone`. */
export function dayRangeFor(date: LocalDate, timeZone: string): DayRange {
  return { date, from: startOf(date, timeZone), to: startOf(addDays(date, 1), timeZone) };
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const clocks = new Map<string, Intl.DateTimeFormat>();

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = clocks.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    clocks.set(timeZone, f);
  }
  return f;
}

/** The wall clock at `at` in `timeZone`, written as if it were a UTC instant. */
function wallAsUtc(at: number, timeZone: string): number {
  const parts = clockFormatter(timeZone).formatToParts(new Date(at));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
}

/**
 * Wall-clock minutes from local midnight of `date` to `at`, so 09:30 is 570
 * even on a day that is 23 or 25 hours long. Instants on the next local day
 * count past 1440; seconds are dropped.
 */
export function localMinutes(at: Date, date: LocalDate, timeZone: string): number {
  return (wallAsUtc(at.getTime(), timeZone) - Date.parse(`${date}T00:00:00Z`)) / MINUTE;
}

/**
 * The instant whose wall clock on `date` reads `minutes` past midnight.
 * A repeated time resolves to its first occurrence; a skipped time moves
 * forward by the size of the gap, as clocks do.
 */
export function instantAt(date: LocalDate, minutes: number, timeZone: string): Date {
  const wall = Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE;
  const offsetAt = (t: number) => wallAsUtc(t, timeZone) - Math.floor(t / MINUTE) * MINUTE;
  // Offsets near `wall` give at most two candidates, one per side of a transition.
  const candidates = [...new Set([offsetAt(wall - DAY / 2), offsetAt(wall), offsetAt(wall + DAY / 2)])]
    .map((offset) => wall - offset)
    .sort((a, b) => a - b);
  const exact = candidates.find((t) => wallAsUtc(t, timeZone) === wall);
  if (exact !== undefined) return new Date(exact);
  return new Date(wall - offsetAt(candidates[0]));
}

/** Parse an untrusted time zone name, falling back to UTC. */
export function resolveTimeZone(raw: string | undefined): string {
  if (!raw || raw.length > 64) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", { timeZone: raw }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
