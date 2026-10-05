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

function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10) as LocalDate;
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

/** Parse an untrusted time zone name, falling back to UTC. */
export function resolveTimeZone(raw: string | undefined): string {
  if (!raw || raw.length > 64) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", { timeZone: raw }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
