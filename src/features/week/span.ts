import type { LocalDate } from "@/domain/item";
import { dayHref, type KeyPress } from "@/features/day/nav";
import type { DayViewMode } from "@/features/day/types";
import { addMonths, anchorOf, firstOf, monthHref, monthOf, parseYearMonth } from "@/features/month/model";
import { addDays, parseLocalDate } from "@/lib/dates";
import { anchorDay, narrowDays, WEEK_STARTS_ON, weekHref, weekOf, type WeekStart } from "./model";

export type Span = "day" | "week" | "month";

/**
 * Where Day, Week and Month in the side panel (and the D, W and M keys) go from a page whose focus is `anchor`:
 * the day itself (today when the week or month holds it), the week holding it
 * and the month holding it. The day keeps its grid or List.
 */
export function spanHrefs(
  anchor: LocalDate,
  today: LocalDate,
  mode: DayViewMode = "grid",
  startsOn: WeekStart = WEEK_STARTS_ON,
): Record<Span, string> {
  return { day: dayHref(anchor, today, mode), week: weekHref(anchor, today, startsOn), month: monthHref(monthOf(anchor), today) };
}

/** The same three links passed through `keep`, which carries the address's area or tag filter onto each. */
export function keepSpans(hrefs: Record<Span, string>, keep: (href: string) => string): Record<Span, string> {
  return { day: keep(hrefs.day), week: keep(hrefs.week), month: keep(hrefs.month) };
}

/**
 * What a signed-in address shows of the calendar: which span, the day it is about (`anchor`), and
 * the first and last day in view (`narrow`: as a phone shows the Week, three days). A page that is no calendar view has no span and no days in view;
 * its anchor is today, so the side panel's month opens on this month and a day picked there opens that day.
 */
export type CalendarView = { span: Span | null; anchor: LocalDate; from: LocalDate | null; to: LocalDate | null };

export function calendarView(pathname: string, today: LocalDate, startsOn: WeekStart = WEEK_STARTS_ON, narrow = false): CalendarView {
  const [, root, rest] = /^\/(today|day|week|month)(?:\/([^/]+))?\/?$/.exec(pathname) ?? [];
  if (root === "today" && rest === undefined) return { span: "day", anchor: today, from: today, to: today };
  if (root === "day") {
    const date = parseLocalDate(rest);
    if (date) return { span: "day", anchor: date, from: date, to: date };
  }
  if (root === "week") {
    const date = rest === undefined ? today : parseLocalDate(rest);
    if (date) {
      // A narrow screen shows three days of the week, from the day its address names.
      const days = narrow ? narrowDays(date) : weekOf(date, startsOn);
      return { span: "week", anchor: anchorDay(days, today), from: days[0], to: days[days.length - 1] };
    }
  }
  if (root === "month") {
    const month = rest === undefined ? monthOf(today) : parseYearMonth(rest);
    if (month) return { span: "month", anchor: anchorOf(month, today), from: firstOf(month), to: addDays(firstOf(addMonths(month, 1)), -1) };
  }
  return { span: null, anchor: today, from: null, to: null };
}

const SPAN_KEYS: Record<string, Span> = { d: "day", w: "week", m: "month" };

/**
 * D, W and M switch between the day, the week and the month on a calendar view. Never while typing,
 * with a modifier held, or once something closer took the key: D on a focused item marks it done.
 */
export function spanShortcut(e: KeyPress): Span | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.defaultPrevented || e.typing) return null;
  return SPAN_KEYS[e.key.toLowerCase()] ?? null;
}
