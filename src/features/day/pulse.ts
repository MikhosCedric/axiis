import type { LocalDate } from "@/domain/item";
import type { WeekData } from "@/features/week/load";
import { toLocalDate } from "@/lib/dates";

/** One day of the week in a line: how many items are planned for it and how many of those are done. */
export type PulseDay = { date: LocalDate; total: number; done: number };

export type PulseData = { days: PulseDay[]; total: number; done: number };

/**
 * The week that holds today, a day at a time: planned and done counts. Notes and dropped items are not
 * counted, and an item with no day is not in any day. It is the Week screen's own read, boiled down.
 */
export function weekPulse(week: WeekData): PulseData {
  const days: PulseDay[] = week.days.map((date) => ({ date, total: 0, done: 0 }));
  const at = new Map(days.map((d) => [d.date, d]));
  for (const item of week.scheduled) {
    if (item.type === "note" || item.status === "dropped") continue;
    const s = item.schedule;
    const on = s.kind === "timed" ? toLocalDate(s.start, week.timeZone) : s.kind === "day" ? s.on : null;
    const day = on ? at.get(on) : undefined;
    if (!day) continue;
    day.total += 1;
    if (item.status === "done") day.done += 1;
  }
  return { days, total: days.reduce((n, d) => n + d.total, 0), done: days.reduce((n, d) => n + d.done, 0) };
}
