import type { LocalDate } from "@/domain/item";
import { dayHref } from "@/features/day/nav";
import type { DayViewMode } from "@/features/day/types";
import { monthHref, monthOf } from "@/features/month/model";
import { weekHref } from "./model";

export type Span = "day" | "week" | "month";

/**
 * Where the Day, Week and Month switch goes from a page whose focus is `anchor`:
 * the day itself (today when the week or month holds it), the week holding it
 * and the month holding it. The day keeps its Score or List.
 */
export function spanHrefs(anchor: LocalDate, today: LocalDate, mode: DayViewMode = "score"): Record<Span, string> {
  return { day: dayHref(anchor, today, mode), week: weekHref(anchor, today), month: monthHref(monthOf(anchor), today) };
}

/** The same three links passed through `keep`, which carries the address's area or tag filter onto each. */
export function keepSpans(hrefs: Record<Span, string>, keep: (href: string) => string): Record<Span, string> {
  return { day: keep(hrefs.day), week: keep(hrefs.week), month: keep(hrefs.month) };
}
