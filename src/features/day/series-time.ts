import type { LocalDate, ShownItem } from "@/domain/item";
import type { TimeOfDay } from "@/features/detail/model";
import type { Placement } from "@/features/score/drop";
import { DAY_MINUTES } from "@/features/score/layout";
import { localMinutes } from "@/lib/dates";

/** After one occurrence gets a new time, the offer to give its whole series that time. */
export type SeriesTimeOffer = { id: string; title: string; time: TimeOfDay; cadence: string };

/**
 * The offer for a placement, or null when there is none: the item is not part
 * of a live series, it did not get a new time, or the time starts outside the day.
 * `cadences` is how often each live series repeats, by series id.
 */
export function seriesTimeOffer(
  item: ShownItem,
  placement: Placement,
  date: LocalDate,
  timeZone: string,
  cadences: Record<string, string>,
): SeriesTimeOffer | null {
  const r = item.recurrence;
  const s = placement.schedule;
  if ((r.kind !== "occurrence" && r.kind !== "override") || !cadences[r.seriesId] || s.kind !== "timed") return null;
  const was = item.schedule;
  if (was.kind === "timed" && was.start.getTime() === s.start.getTime() && was.end.getTime() === s.end.getTime()) return null;
  const start = localMinutes(s.start, date, timeZone);
  if (start < 0 || start >= DAY_MINUTES) return null;
  return { id: item.id, title: item.title, time: { start, length: Math.round((s.end.getTime() - s.start.getTime()) / 60_000) }, cadence: cadences[r.seriesId] };
}
