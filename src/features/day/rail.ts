import type { AreaId, LocalDate } from "@/domain/item";
import { dayRangeFor } from "@/lib/dates";
import { daySpan, loadOccurrences, type LoadedOccurrences } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";

/**
 * Open items per area on `date`, for the nav rail: the number the day screen
 * shows open, without loading the day. Stored items are counted by the
 * database; occurrences of a series not yet touched that day are expanded and
 * counted here, since they have no row.
 */
export async function loadRailCounts(
  repo: ItemsRepo,
  date: LocalDate,
  timeZone: string,
  /** The day's occurrences when the request already loaded them, so the series are read once. */
  loaded?: PromiseLike<LoadedOccurrences>,
): Promise<Map<AreaId, number>> {
  const range = dayRangeFor(date, timeZone);
  const [stored, { occurrences }] = await Promise.all([
    repo.openCountByArea(range),
    loaded ?? loadOccurrences(repo, daySpan(date, timeZone), timeZone),
  ]);
  const counts = new Map(Object.entries(stored) as [AreaId, number][]);
  for (const { areaId } of occurrences) if (areaId !== null) counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
  return counts;
}
