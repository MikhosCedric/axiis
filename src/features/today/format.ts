import type { LocalDate } from "@/domain/item";
import { utcMidnight } from "@/lib/dates";

const heading = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * "Tuesday 6 October". The date is already local, so it is formatted as a UTC
 * calendar day. A stored date no calendar can name is shown as written.
 */
export function formatDayHeading(date: LocalDate): string {
  const at = utcMidnight(date);
  return Number.isNaN(at) ? date : heading.format(at);
}

/** `formatDayHeading`, with the year when it is not the year of `today`: "Thursday 7 January 2027". */
export function formatDayIn(date: LocalDate, today: LocalDate): string {
  const year = yearOf(date) === yearOf(today) ? "" : ` ${yearOf(date)}`;
  return `${formatDayHeading(date)}${year}`;
}

const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Wed 7 Oct", with the year when it is not the year of `today`: "Thu 7 Jan 2027". For a row that has little room. */
export function formatDayShort(date: LocalDate, today: LocalDate): string {
  const at = utcMidnight(date);
  if (Number.isNaN(at)) return date;
  const year = yearOf(date) === yearOf(today) ? "" : ` ${yearOf(date)}`;
  return `${dayName.format(at)} ${dayMonth.format(at)}${year}`;
}

export function yearOf(date: LocalDate): string {
  return date.slice(0, date.indexOf("-", 1));
}