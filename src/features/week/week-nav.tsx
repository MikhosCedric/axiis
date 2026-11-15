import { CalendarBar } from "@/components/shell/calendar-bar";
import type { LocalDate } from "@/domain/item";

/** The Week's top bar: the shared calendar bar, with the week's range as the page's title (`week-title`). */
export function WeekNav({ days, today }: { days: LocalDate[]; today: LocalDate }) {
  return <CalendarBar span="week" date={days[0]} today={today} titleId="week-title" />;
}
