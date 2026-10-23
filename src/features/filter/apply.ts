import type { DayData } from "@/features/day/types";
import type { InboxData } from "@/features/inbox/model";
import type { WeekData } from "@/features/week/load";
import { isFiltered, keeps, type ViewFilter } from "./model";

/*
 * How a filter narrows each view's data, already loaded on the server: no view
 * reads anything more for a filter. Counts drawn from the result (the glance
 * line, Next up, the open counts) then count only what is shown.
 */

/** A filtered day keeps only its items in the area or with the tag. An area filter also keeps only that area's staff. */
export function filterDay(data: DayData, f: ViewFilter): DayData {
  if (!isFiltered(f)) return data;
  const kept = ({ item }: { item: { id: string; areaId: string | null } }) => keeps(f, item, data.tags[item.id]);
  return {
    ...data,
    areas: f.area ? data.areas.filter((a) => a.id === f.area!.id) : data.areas,
    view: { scheduled: data.view.scheduled.filter(kept), waiting: data.view.waiting.filter(kept) },
  };
}

export function filterWeek(data: WeekData, f: ViewFilter): WeekData {
  if (!isFiltered(f)) return data;
  const kept = (item: { id: string; areaId: string | null }) => keeps(f, item, data.tags[item.id]);
  return { ...data, scheduled: data.scheduled.filter(kept), unscheduled: data.unscheduled.filter(kept) };
}

export function filterInbox(data: InboxData, f: ViewFilter): InboxData {
  if (!isFiltered(f)) return data;
  return { ...data, items: data.items.filter((item) => keeps(f, item, data.tags[item.id])) };
}

/** Rows that name their area and carry no tags: Due, Lists and Notes, which filter by area only. */
export function filterRows<R extends { areaId: string | null }>(rows: R[], f: ViewFilter): R[] {
  return isFiltered(f) ? rows.filter((r) => keeps(f, r, undefined)) : rows;
}
