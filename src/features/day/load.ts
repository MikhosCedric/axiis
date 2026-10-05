import type { LocalDate } from "@/domain/item";
import { buildToday } from "@/features/today/model";
import { dayRangeFor, isSameDay } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import type { DayData } from "./types";

export async function loadDay(repo: ItemsRepo, date: LocalDate, now: Date, timeZone: string): Promise<DayData> {
  const range = dayRangeFor(date, timeZone);
  const [areas, items] = await Promise.all([repo.listAreas(), repo.listForDay(range)]);
  const view = buildToday(items, range, now);
  const shownIds = [...view.scheduled, ...view.waiting].map((e) => e.item.id);
  const childCounts = shownIds.length ? await repo.childCounts(shownIds) : {};
  return {
    timeZone,
    date,
    isToday: isSameDay(date, now, timeZone),
    nowIso: now.toISOString(),
    areas,
    view,
    childCounts,
  };
}
