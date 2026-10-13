import { isStored, type LocalDate } from "@/domain/item";
import { firstDay } from "@/features/detail/model";
import { cadence } from "@/features/detail/repeat";
import { tagsOfShown } from "@/features/tags/commands";
import { buildToday } from "@/features/today/model";
import { addDays, dayRangeFor, isSameDay } from "@/lib/dates";
import { loadOccurrences } from "@/lib/items/occurrences";
import { WAITING_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import type { DayData } from "./types";

export async function loadDay(repo: ItemsRepo, date: LocalDate, now: Date, timeZone: string): Promise<DayData> {
  const range = dayRangeFor(date, timeZone);
  const span = { from: range.from, to: range.to, fromDate: date, toDate: addDays(date, 1) };
  const [areas, items, { occurrences, series }] = await Promise.all([
    repo.listAreas(),
    repo.listForDay(range),
    loadOccurrences(repo, span, timeZone),
  ]);
  const view = buildToday({ scheduled: [...items.scheduled, ...occurrences], unscheduled: items.unscheduled }, range, now);
  // Virtual occurrences are never parents, so only stored items are counted.
  const shown = [...view.scheduled, ...view.waiting].map((e) => e.item);
  const storedIds = shown.flatMap((i) => (isStored(i) ? [i.id] : []));
  // A day that shows anything already answers the first-day question, so only an empty one asks the repo.
  const [childCounts, tags, anyItem] = await Promise.all([
    storedIds.length ? repo.childCounts(storedIds) : {},
    tagsOfShown(repo, shown, series.map((s) => s.id)),
    shown.length > 0 || series.length > 0 || repo.hasAnyItem(),
  ]);
  return {
    timeZone,
    date,
    isToday: isSameDay(date, now, timeZone),
    nowIso: now.toISOString(),
    areas,
    view,
    waitingFull: items.unscheduled.length >= WAITING_LIMIT,
    childCounts,
    tags,
    firstDay: !anyItem,
    cadences: Object.fromEntries(
      series.flatMap((s) => (s.recurrence.kind === "series" ? [[s.id, cadence(s.recurrence.rule, firstDay(s.schedule, timeZone))]] : [])),
    ),
  };
}
