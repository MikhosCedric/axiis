import type { LocalDate } from "@/domain/item";
import { WEEK_LENGTH, weekOf } from "@/features/week/model";
import { addDays, parseLocalDate } from "@/lib/dates";
import { fold } from "./rank";

/** Weekday numbers as `Date#getUTCDay` gives them (0 is Sunday). */
const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const RELATIVE: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1 };
// Far enough to reach the next 29 February from any date.
const LEAP_SEARCH_YEARS = 8;

const weekday = (date: LocalDate) => new Date(`${date}T00:00:00Z`).getUTCDay();
const pad = (n: number, width: number) => String(n).padStart(width, "0");

function calendarDate(year: number, month: number, day: number): LocalDate | null {
  return parseLocalDate(`${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`);
}

/** A month and day with no year: the next time it comes round, today included. */
function nextMonthDay(month: number, day: number, today: LocalDate): LocalDate | null {
  const year = Number(today.slice(0, 4));
  for (let y = year; y <= year + LEAP_SEARCH_YEARS; y++) {
    const date = calendarDate(y, month, day);
    if (date && date >= today) return date;
  }
  return null;
}

function monthDay(month: string, day: string, year: string | undefined, today: LocalDate): LocalDate | null {
  const m = MONTHS[month];
  if (m === undefined) return null;
  return year === undefined ? nextMonthDay(m, Number(day), today) : calendarDate(Number(year), m, Number(day));
}

/**
 * The date a typed phrase names, counted from `today`, or null when it names none.
 * Understands today, tomorrow, yesterday, a weekday (the next one, today
 * included), "next" and a weekday (that day in next week), "in 3 days" or
 * "in 2 weeks", 2026-12-24, and a month with a day in either order, with or
 * without a year ("dec 24", "24 December 2027").
 */
export function parseDatePhrase(text: string, today: LocalDate): LocalDate | null {
  const phrase = fold(text).replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (phrase in RELATIVE) return addDays(today, RELATIVE[phrase]);

  const iso = parseLocalDate(phrase);
  if (iso) return iso;

  let m = /^(next )?([a-z]+)$/.exec(phrase);
  if (m && m[2] in WEEKDAYS) {
    const target = WEEKDAYS[m[2]];
    if (!m[1]) return addDays(today, (target - weekday(today) + WEEK_LENGTH) % WEEK_LENGTH);
    const nextWeek = addDays(weekOf(today)[0], WEEK_LENGTH);
    return addDays(nextWeek, (target - weekday(nextWeek) + WEEK_LENGTH) % WEEK_LENGTH);
  }

  m = /^in (\d{1,4}|a|one) (day|days|week|weeks)$/.exec(phrase);
  if (m) {
    const n = /^\d/.test(m[1]) ? Number(m[1]) : 1;
    return addDays(today, m[2].startsWith("week") ? n * WEEK_LENGTH : n);
  }

  m = /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(phrase);
  if (m) return monthDay(m[1], m[2], m[3], today);

  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?(?: (\d{4}))?$/.exec(phrase);
  if (m) return monthDay(m[2], m[1], m[3], today);

  return null;
}

const DAY_NAMES = Object.keys(WEEKDAYS).filter((w) => w.endsWith("day"));
const COMPLETIONS = [...Object.keys(RELATIVE), ...DAY_NAMES, ...DAY_NAMES.map((w) => `next ${w}`)];
const MIN_COMPLETION = 3;

/** The one phrase a partly typed word can only be heading for ("tom" to "tomorrow"), or null when it is short, exact or could be several. */
export function completeDatePhrase(text: string): string | null {
  const phrase = fold(text);
  if (phrase.length < MIN_COMPLETION) return null;
  const found = COMPLETIONS.filter((c) => c.startsWith(phrase) && c !== phrase);
  return found.length === 1 ? found[0] : null;
}
