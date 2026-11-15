import { CalendarBar } from "@/components/shell/calendar-bar";
import type { LocalDate } from "@/domain/item";
import type { DayViewMode } from "./types";

/** The Day's top bar: the shared calendar bar, with the day as the page's title (`day-title`). */
export function DayNav({ date, today, mode }: { date: LocalDate; today: LocalDate; mode: DayViewMode }) {
  return <CalendarBar span="day" date={date} today={today} mode={mode} titleId="day-title" />;
}
