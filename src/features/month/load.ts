import type { LocalDate } from "@/domain/item";
import type { Clock } from "@/lib/clock";
import { toLocalDate } from "@/lib/dates";
import { loadOccurrences } from "@/lib/items/occurrences";
import { RANGE_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import { keeps, NO_FILTER, scopeWords, type ViewFilter } from "@/features/filter/model";
import { buildMonth, monthGrid, monthRange, monthSummary, type MonthCell, type YearMonth } from "./model";

/** Everything the month screen draws, worked out on the server. Each day carries at most `MARKS_PER_DAY` marks. */
export type MonthData = {
  month: YearMonth;
  today: LocalDate;
  cells: MonthCell[];
  summary: string;
  /** The planned read hit `RANGE_LIMIT`, so later items of the month are not drawn. */
  full: boolean;
};

/**
 * One bounded read of everything planned across the grid, one of what falls
 * due in it, and the series expanded once over the same span. No read per day.
 */
export async function loadMonth(
  repo: ItemsRepo,
  month: YearMonth,
  now: Date,
  timeZone: string,
  clock: Clock,
  filter: ViewFilter = NO_FILTER,
): Promise<MonthData> {
  const days = monthGrid(month);
  const span = monthRange(days, timeZone);
  const [areas, stored, { occurrences }, due] = await Promise.all([
    repo.listAreas(),
    repo.listRange(span),
    loadOccurrences(repo, span, timeZone),
    repo.listDueIn(days[0], span.toDate),
  ]);
  // A filter narrows what is drawn before the marks are counted, so "+3 more" counts only what it keeps.
  const kept = (item: { areaId: string | null }) => keeps(filter, item, undefined);
  const { cells, open, due: dueCount } = buildMonth({
    month,
    days,
    scheduled: [...stored, ...occurrences].filter(kept),
    due: due.filter(kept),
    areas,
    timeZone,
    clock,
    now,
  });
  const today = toLocalDate(now, timeZone);
  return {
    month,
    today,
    cells,
    summary: monthSummary(month, today, open, dueCount, scopeWords(filter)),
    full: stored.length >= RANGE_LIMIT || due.length >= RANGE_LIMIT,
  };
}
