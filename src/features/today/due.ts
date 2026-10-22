import type { LocalDate } from "@/domain/item";
import { utcMidnight } from "@/lib/dates";

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * A due date in a few words, from today: "Past due", "Due today", "Due tomorrow", "Due Tue" within the week,
 * then "Due 3 Nov". `near` is true once the date has come, for the filled flag. Never counts days late.
 */
export function dueWords(dueOn: LocalDate, today: LocalDate): { words: string; near: boolean } {
  const days = Math.round((utcMidnight(dueOn) - utcMidnight(today)) / 86_400_000);
  if (days < 0) return { words: "Past due", near: true };
  if (days === 0) return { words: "Due today", near: true };
  if (days === 1) return { words: "Due tomorrow", near: false };
  const at = utcMidnight(dueOn);
  return { words: `Due ${days < 7 ? weekday.format(at) : dayMonth.format(at)}`, near: false };
}
