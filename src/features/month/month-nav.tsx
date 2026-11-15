import { CalendarBar } from "@/components/shell/calendar-bar";
import type { LocalDate } from "@/domain/item";
import { firstOf, type YearMonth } from "./model";

/** The Month's top bar: the shared calendar bar, with the month as the page's title (`month-h`). */
export function MonthNav({ month, today }: { month: YearMonth; today: LocalDate }) {
  return <CalendarBar span="month" date={firstOf(month)} today={today} titleId="month-h" />;
}
