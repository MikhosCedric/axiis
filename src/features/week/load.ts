import type { Area, Item, LocalDate, ShownItem } from "@/domain/item";
import type { TagColors, TagName } from "@/domain/tag";
import { tagsOfShown } from "@/features/tags/commands";
import { dayRangeFor, toLocalDate } from "@/lib/dates";
import { loadOccurrences } from "@/lib/items/occurrences";
import { RANGE_LIMIT, WAITING_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import { weekOf, weekRange } from "./model";

/** Everything the week screen needs, loaded on the server and serializable to the client. */
export type WeekData = {
  timeZone: string;
  days: LocalDate[];
  today: LocalDate;
  /** The request's "now", so server and client agree on what is live. */
  nowIso: string;
  areas: Area[];
  /** Items planned on any day of the week, with the occurrences of every series that fall in it. */
  scheduled: ShownItem[];
  /** Top-level items with no schedule, open or done today, for the tray. */
  unscheduled: Item[];
  /** The planned read hit `RANGE_LIMIT`, so later items of the week are not drawn. */
  weekFull: boolean;
  /** The waiting read hit `WAITING_LIMIT`, so older waiting items are not shown. */
  waitingFull: boolean;
  /** Tag names on everything shown, by the id it is shown with. An occurrence wears its series' tags. */
  tags: Record<string, TagName[]>;
  /** The colour of each coloured tag shown, by `tagKey`. */
  tagColors: TagColors;
};

export async function loadWeek(repo: ItemsRepo, date: LocalDate, now: Date, timeZone: string): Promise<WeekData> {
  const days = weekOf(date);
  const span = weekRange(days, timeZone);
  const today = toLocalDate(now, timeZone);
  // The tray keeps what was ticked done today, as the day screen's does, so the read is today's.
  const [areas, stored, { occurrences, series }, waiting] = await Promise.all([
    repo.listAreas(),
    repo.listRange(span),
    loadOccurrences(repo, span, timeZone),
    repo.listForDay(dayRangeFor(today, timeZone)),
  ]);
  const scheduled = [...stored, ...occurrences];
  const tags = await tagsOfShown(repo, [...scheduled, ...waiting.unscheduled], series.map((s) => s.id));
  return {
    timeZone,
    days,
    today,
    nowIso: now.toISOString(),
    areas,
    scheduled,
    unscheduled: waiting.unscheduled,
    weekFull: stored.length >= RANGE_LIMIT,
    waitingFull: waiting.unscheduled.length >= WAITING_LIMIT,
    tags: tags.names,
    tagColors: tags.colors,
  };
}
