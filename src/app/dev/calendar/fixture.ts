import type { AreaColor } from "@/domain/area-color";
import type { Area, Item, ItemId, LocalDate } from "@/domain/item";
import type { CalendarData } from "@/features/calendar/calendar-view";
import { weekCalendar } from "@/features/calendar/load";
import { makeItem } from "@/features/today/test-support";
import { loadWeek } from "@/features/week/load";
import { weekOf } from "@/features/week/model";
import { instantAt } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import { seedWeek } from "./week-fixture";

const COLORS: Record<string, AreaColor> = { Work: "indigo", Home: "clay", Health: "sage" };

let seq = 0;
const id = () => `f2000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

/**
 * The week harness's week, with its areas coloured and what a time grid has to get right added: three
 * items that overlap, a ten-minute one, and one that runs past midnight.
 */
export function seedCalendar(shown: LocalDate, now: Date, timeZone: string): { items: Item[]; areas: Area[] } {
  seq = 0;
  const seeded = seedWeek(shown, now, timeZone);
  const areas = seeded.areas.map((a) => ({ ...a, color: COLORS[a.name] ?? null }));
  const [work, home, health] = areas;
  const days = weekOf(shown);
  const timed = (day: number, title: string, area: Area | null, from: number, to: number, over: Partial<Item> = {}) =>
    makeItem({
      id: id() as ItemId,
      title,
      areaId: area?.id ?? null,
      schedule: { kind: "timed", start: instantAt(days[day], from, timeZone), end: instantAt(days[day], to, timeZone) },
      ...over,
    });
  const items = [
    ...seeded.items,
    timed(2, "Budget review", work, 9 * 60 + 30, 10 * 60 + 30),
    timed(2, "Call the plumber", home, 10 * 60, 10 * 60 + 30),
    timed(2, "Take the bins out", home, 11 * 60 + 30, 11 * 60 + 40),
    timed(5, "Night train", null, 23 * 60, 25 * 60, { type: "event" }),
    timed(3, "Physio", health, 8 * 60, 9 * 60, { dueOn: days[4] }),
  ];
  return { items, areas };
}

/** The grid's query for the harness: the week's own loader over the in-memory repo, as the Week page turns it into the grid's data. */
export async function loadCalendar(repo: ItemsRepo, date: LocalDate, now: Date, timeZone: string): Promise<{ data: CalendarData; week: LocalDate[] }> {
  const week = await loadWeek(repo, date, now, timeZone);
  return { week: week.days, data: await weekCalendar(repo, week) };
}
