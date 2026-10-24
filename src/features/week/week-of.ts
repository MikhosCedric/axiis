import type { LocalDate } from "@/domain/item";
import { addDays } from "@/lib/dates";

/** First day of the week, as `Date#getUTCDay` numbers it (0 is Sunday). One place, so it can become a setting. */
export const WEEK_STARTS_ON = 1;
export const WEEK_LENGTH = 7;

/** The seven local dates of the week that holds `date`, first day first. */
export function weekOf(date: LocalDate): LocalDate[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -((weekday - WEEK_STARTS_ON + WEEK_LENGTH) % WEEK_LENGTH));
  return Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(start, i));
}
