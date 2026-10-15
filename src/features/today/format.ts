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

export function yearOf(date: LocalDate): string {
  return date.slice(0, date.indexOf("-", 1));
}