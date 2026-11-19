import type { AreaColor } from "@/domain/area-color";
import type { AreaId, ItemId, ItemType, LocalDate } from "@/domain/item";
import type { QuickItem } from "@/features/actions/model";
import { formatDayIn } from "@/features/today/format";
import { weekOf } from "@/features/week/week-of";
import { addDays } from "@/lib/dates";
import { DONE_LIMIT } from "@/lib/items/repo";

export const DONE_PATH = "/done";

/** Items shown at first, and added by each "Show earlier". */
export const DONE_PAGE = 50;
export const DONE_PAGE_PARAM = "pages";
const MAX_PAGES = Math.floor(DONE_LIMIT / DONE_PAGE);

/** How many pages the address asks for: one unless it names a whole number from 1 to the most the read allows. */
export function readPages(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGES) : 1;
}

/** One finished item, already worded for the user's zone. */
export type DoneRow = {
  quick: QuickItem;
  id: ItemId;
  type: ItemType;
  title: string;
  /** The day it was finished, in the user's zone. */
  doneOn: LocalDate;
  areaId: AreaId | null;
  area: string | null;
  areaColor: AreaColor | null;
  tags: string[];
};

export type DoneData = {
  today: LocalDate;
  rows: DoneRow[];
  /** Earlier items remain beyond these, so "Show earlier" has something to show. */
  more: boolean;
  pages: number;
};

export type DoneDay = { date: LocalDate; heading: string; rows: DoneRow[] };

/** "Today", "Yesterday", otherwise the weekday and date, with the year when it is not this one. */
export function doneHeading(date: LocalDate, today: LocalDate): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatDayIn(date, today);
}

/** The rows, in the order they came (newest first), cut into one section per day finished. */
export function groupByDay(rows: readonly DoneRow[], today: LocalDate): DoneDay[] {
  const days: DoneDay[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last && last.date === row.doneOn) last.rows.push(row);
    else days.push({ date: row.doneOn, heading: doneHeading(row.doneOn, today), rows: [row] });
  }
  return days;
}

export function doneSummary(shown: number, more: boolean): string {
  if (shown === 0) return "Nothing yet";
  return more ? `Latest ${shown}` : `${shown} finished`;
}

/**
 * How many were finished in the week that holds `today`, as a bare count: "This week: 12 done". When the read stopped
 * inside this week (more remain, and the oldest row shown is still this week), the true count is higher, so it says "12+".
 */
export function weekDoneLine(rows: readonly Pick<DoneRow, "doneOn">[], today: LocalDate, more: boolean): string {
  const week = weekOf(today);
  const count = rows.filter((r) => r.doneOn >= week[0] && r.doneOn <= week[6]).length;
  const cut = more && rows.length > 0 && rows[rows.length - 1].doneOn >= week[0];
  return `This week: ${count}${cut ? "+" : ""} done`;
}
