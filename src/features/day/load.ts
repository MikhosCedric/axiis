import { isStored, type LocalDate } from "@/domain/item";
import { buildToday } from "@/features/today/model";
import { addDays, dayRangeFor, isSameDay } from "@/lib/dates";
import { loadOccurrences } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import type { DayData } from "./types";

export async function loadDay(repo: ItemsRepo, date: LocalDate, now: Date, timeZone: string): Promise<DayData> {
  const range = dayRangeFor(date, timeZone);
  const span = { from: range.from, to: range.to, fromDate: date, toDate: addDays(date, 1) };
  const [areas, items, occurrences] = await Promise.all([
    repo.listAreas(),
    repo.listForDay(range),
    loadOccurrences(repo, span, timeZone),
  ]);
  const view = buildToday({ scheduled: [...items.scheduled, ...occurrences], unscheduled: items.unscheduled }, range, now);
  // Virtual occurrences are never parents, so only stored items are counted.
  const storedIds = [...view.scheduled, ...view.waiting].flatMap((e) => (isStored(e.item) ? [e.item.id] : []));
  const childCounts = storedIds.length ? await repo.childCounts(storedIds) : {};
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
