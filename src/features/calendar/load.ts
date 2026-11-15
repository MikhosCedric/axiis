import { isStored } from "@/domain/item";
import type { DayData } from "@/features/day/types";
import type { WeekData } from "@/features/week/load";
import { toLocalDate } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import type { CalendarData } from "./calendar-view";

// What the grid draws on each page, made from the reads the Day and the Week already do: nothing here
// asks for an item twice. Filters narrow the day or the week first, so the grid only ever gets what shows.

/** A loaded day as the grid's data. The day's read already counted subtasks and gathered tags. */
export function dayCalendar(day: DayData): CalendarData {
  return {
    timeZone: day.timeZone,
    today: toLocalDate(new Date(day.nowIso), day.timeZone),
    nowIso: day.nowIso,
    areas: day.areas,
    items: day.view.scheduled.map((e) => e.item),
    tray: day.view.waiting.map((e) => e.item),
    trayFull: day.waitingFull,
    childCounts: day.childCounts,
    tags: day.tags,
  };
}

/** A loaded week as the grid's data, with one more read: the subtask counts of what it shows. */
export async function weekCalendar(repo: ItemsRepo, week: WeekData): Promise<CalendarData> {
  const stored = [...week.scheduled, ...week.unscheduled].flatMap((i) => (isStored(i) ? [i.id] : []));
  return {
    timeZone: week.timeZone,
    today: week.today,
    nowIso: week.nowIso,
    areas: week.areas,
    items: week.scheduled,
    tray: week.unscheduled,
    trayFull: week.waitingFull,
    childCounts: stored.length ? await repo.childCounts(stored) : {},
    tags: week.tags,
  };
}
