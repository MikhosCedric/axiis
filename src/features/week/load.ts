import type { Area, Item, LocalDate, ShownItem } from "@/domain/item";
import { dayRangeFor, toLocalDate } from "@/lib/dates";
import { loadOccurrences } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
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
  /** Top-level items with no schedule, for the tray. */
  unscheduled: Item[];
};

export async function loadWeek(repo: ItemsRepo, date: LocalDate, now: Date, timeZone: string): Promise<WeekData> {
  const days = weekOf(date);
  const span = weekRange(days, timeZone);
  const [areas, scheduled, occurrences, first] = await Promise.all([
    repo.listAreas(),
    repo.listRange(span),
    loadOccurrences(repo, span, timeZone),
    repo.listForDay(dayRangeFor(days[0], timeZone)),
  ]);
  return {
    timeZone,
    days,
    today: toLocalDate(now, timeZone),
    nowIso: now.toISOString(),
    areas,
    scheduled: [...scheduled, ...occurrences],
    unscheduled: first.unscheduled,
  };
}
