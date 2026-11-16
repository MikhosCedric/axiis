import type { LocalDate } from "@/domain/item";
import { addDays } from "@/lib/dates";

/** The first day of the week, as `Date#getUTCDay` numbers it: 1 is Monday, 0 is Sunday. */
export type WeekStart = 0 | 1;

/** The first day of the week when nothing else is said: Monday. Settings can make it Sunday (`week-start` cookie). */
export const WEEK_STARTS_ON: WeekStart = 1;
export const WEEK_LENGTH = 7;
/** How many days a narrow screen draws of a week, from the day in its address (ADR-0004). */
export const NARROW_DAYS = 3;

/** The days a narrow screen shows of the Week at `from`: that day and the two after it. */
export function narrowDays(from: LocalDate): LocalDate[] {
  return Array.from({ length: NARROW_DAYS }, (_, i) => addDays(from, i));
}

/**
 * The seven local dates of the week that holds `date`, first day first. Pure date arithmetic on calendar dates, so a
 * day the clocks change is a day like any other here; `weekRange` turns the dates into instants.
 */
export function weekOf(date: LocalDate, startsOn: WeekStart = WEEK_STARTS_ON): LocalDate[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -((weekday - startsOn + WEEK_LENGTH) % WEEK_LENGTH));
  return Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(start, i));
}
