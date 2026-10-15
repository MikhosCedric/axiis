import { repeats, type Area, type ItemType, type LocalDate, type ShownItem, type SpanRange } from "@/domain/item";
import { stateOf, type BeamState } from "@/features/today/model";
import { formatClock } from "@/features/today/format";
import { WEEK_LENGTH, weekOf } from "@/features/week/model";
import { addDays, dayRangeFor, FIRST_DATE, LAST_DATE, localMinutes, toLocalDate } from "@/lib/dates";
import { RANGE_LIMIT } from "@/lib/items/repo";

/** A calendar month, `YYYY-MM`. */
export type YearMonth = string & { readonly __brand: "YearMonth" };

export const MONTH_PATH = "/month";

/** Most marks one day sends to the page. The rest are a count, and the day itself lists them. */
export const MARKS_PER_DAY = 3;

/** Under a month whose read hit `RANGE_LIMIT`, so later planned items are not drawn. */
export const MONTH_FULL = `Showing the first ${RANGE_LIMIT} planned items around this month. Later ones may be missing.`;

/** Parse an untrusted `YYYY-MM` inside the span Axiis plans on, or null. */
export function parseYearMonth(raw: unknown): YearMonth | null {
  if (typeof raw !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  return raw >= FIRST_DATE.slice(0, 7) && raw <= LAST_DATE.slice(0, 7) ? (raw as YearMonth) : null;
}

export function monthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function firstOf(month: YearMonth): LocalDate {
  return `${month}-01` as LocalDate;
}

export function addMonths(month: YearMonth, n: number): YearMonth {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}` as YearMonth;
}

/** The fewest weeks the grid draws, so a February that fits in four keeps the page's shape. */
export const MIN_WEEKS = 5;

/**
 * The days the grid draws: whole weeks from the week start on or before the
 * 1st through the week holding the last day, five or six of them.
 */
export function monthGrid(month: YearMonth): LocalDate[] {
  const start = weekOf(firstOf(month))[0];
  const last = addDays(firstOf(addMonths(month, 1)), -1);
  const end = weekOf(last)[WEEK_LENGTH - 1];
  const days: LocalDate[] = [];
  for (let d = start; d <= end || days.length < MIN_WEEKS * WEEK_LENGTH; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * The span one read covers for `days`. It starts a day early, so an event that
 * began the evening before the first day and runs past midnight is found too.
 */
export function monthRange(days: readonly LocalDate[], timeZone: string): SpanRange {
  const before = addDays(days[0], -1);
  const after = addDays(days[days.length - 1], 1);
  return { from: dayRangeFor(before, timeZone).from, to: dayRangeFor(after, timeZone).from, fromDate: before, toDate: after };
}

/** `/month` for this month, `/month/<YYYY-MM>` for any other. */
export function monthHref(month: YearMonth, today: LocalDate): string {
  return month === monthOf(today) ? MONTH_PATH : `${MONTH_PATH}/${month}`;
}

/** True for `/month/<x>` where x is no month Axiis plans in, so the proxy can answer a real 404. */
export function namesNoMonth(pathname: string): boolean {
  const match = /^\/month\/([^/]*)\/?$/.exec(pathname);
  if (!match) return false;
  try {
    return parseYearMonth(decodeURIComponent(match[1])) === null;
  } catch {
    return true;
  }
}

export type MonthNavAction = "previous" | "next" | "today";

export function monthNavTarget(action: MonthNavAction, month: YearMonth, today: LocalDate): YearMonth {
  if (action === "today") return monthOf(today);
  const to = addMonths(month, action === "next" ? 1 : -1);
  return parseYearMonth(to) ?? month;
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "October 2026". */
export function formatMonthHeading(month: YearMonth): string {
  return monthYear.format(new Date(`${firstOf(month)}T12:00:00Z`));
}

/** One item as a day of the month draws it. */
export type MonthMark = {
  /** The item key, as `?item=` and the move action take it. */
  key: string;
  title: string;
  type: ItemType;
  state: BeamState;
  /** "09:30" on the day it starts, "to 01:00" on a later day it runs into, null for a day-only or due mark. */
  time: string | null;
  area: string | null;
  repeats: boolean;
  /** Due on this day. */
  due: boolean;
  /** Planned to start on this day, so dragging it to another day moves it. A due-only mark or a later day of a span is not. */
  movable: boolean;
};

export type MonthCell = { date: LocalDate; marks: MonthMark[]; more: number };

export type MonthBuild = { cells: MonthCell[]; open: number; due: number };

const shown = (i: ShownItem) => i.type !== "note" && i.status !== "dropped";

/** Minutes past local midnight that an item can reach and still end on its first day, with three hours to spare for a change of clocks. */
const SURELY_SAME_DAY = 21 * 60;

/** "09:30" from minutes past midnight, as `formatClock` writes it. */
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Placed = { mark: MonthMark; rank: [number, number, number] };

/**
 * Sorts planned and due items into the grid's days. A timed item shows on
 * every day it covers in the user's zone; a day-only item on its date; a due
 * date as a due mark, folded into the planned mark when both fall on one day.
 * Each day keeps day-only items first in area order, then timed by start,
 * then due-only marks, and sends at most `MARKS_PER_DAY` of them.
 */
export function buildMonth(input: {
  month: YearMonth;
  days: readonly LocalDate[];
  scheduled: readonly ShownItem[];
  due: readonly ShownItem[];
  areas: readonly Area[];
  timeZone: string;
  now: Date;
}): MonthBuild {
  const { month, days, timeZone, now } = input;
  const first = days[0];
  const last = days[days.length - 1];
  const areaOf = new Map(input.areas.map((a) => [a.id as string, a]));
  const byDay = new Map<LocalDate, Placed[]>(days.map((d) => [d, []]));
  const inMonth = (d: LocalDate) => monthOf(d) === month;
  let open = 0;
  let due = 0;

  const base = (item: ShownItem) => {
    const area = item.areaId ? (areaOf.get(item.areaId) ?? null) : null;
    return {
      key: item.id,
      title: item.title,
      type: item.type,
      state: stateOf(item, now),
      area: area?.name ?? null,
      repeats: repeats(item),
      areaRank: area?.position ?? Infinity,
    };
  };

  for (const item of input.scheduled) {
    if (!shown(item)) continue;
    const s = item.schedule;
    const { areaRank, ...mark } = base(item);
    if (s.kind === "day") {
      if (s.on < first || s.on > last) continue;
      byDay.get(s.on)!.push({ mark: { ...mark, time: null, due: false, movable: true }, rank: [0, areaRank, item.position] });
      if (inMonth(s.on) && item.status === "open") open++;
      continue;
    }
    if (s.kind !== "timed") continue;
    const startDay = toLocalDate(s.start, timeZone);
    const startMinutes = localMinutes(s.start, startDay, timeZone);
    const length = (s.end.getTime() - s.start.getTime()) / 60_000;
    // Most items end hours before midnight, even allowing for a change of clocks, so their end needs no lookup.
    const endDay = length <= 0 || startMinutes + length < SURELY_SAME_DAY ? startDay : toLocalDate(new Date(s.end.getTime() - 1), timeZone);
    if (inMonth(startDay) && startDay >= first && item.status === "open") open++;
    const from = startDay < first ? first : startDay;
    const to = endDay > last ? last : endDay;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const starts = d === startDay;
      const time = starts ? clock(startMinutes) : `to ${formatClock(s.end, timeZone)}`;
      byDay.get(d)!.push({ mark: { ...mark, time, due: false, movable: starts }, rank: [1, starts ? s.start.getTime() : -Infinity, 0] });
    }
  }

  for (const item of input.due) {
    if (!shown(item) || item.dueOn === null || item.dueOn < first || item.dueOn > last) continue;
    if (inMonth(item.dueOn) && item.status === "open") due++;
    const placed = byDay.get(item.dueOn)!;
    const planned = placed.find((p) => p.mark.key === item.id);
    if (planned) planned.mark.due = true;
    else {
      const { areaRank, ...mark } = base(item);
      placed.push({ mark: { ...mark, time: null, due: true, movable: false }, rank: [2, areaRank, item.position] });
    }
  }

  const cells = days.map((date) => {
    const placed = byDay.get(date)!.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);
    return { date, marks: placed.slice(0, MARKS_PER_DAY).map((p) => p.mark), more: Math.max(0, placed.length - MARKS_PER_DAY) };
  });
  return { cells, open, due };
}

export function monthSummary(open: number, due: number): string {
  const plan = open === 0 ? "Nothing open this month" : `${open} open this month`;
  return due ? `${plan}. ${due} due.` : `${plan}.`;
}

/** How many items a day holds, sent and counted. */
export const dayTotal = (cell: MonthCell) => cell.marks.length + cell.more;

/** "3 items", "1 item", "Nothing planned". */
export function countWords(n: number): string {
  return n === 0 ? "Nothing planned" : `${n} ${n === 1 ? "item" : "items"}`;
}

/**
 * Where a key press moves the grid's focus, as a day offset, or "month" for a
 * whole month either way, or null when the key means nothing to the grid.
 * Home and End go to the ends of the focused week.
 */
export function gridStep(key: string, index: number): { days: number } | { months: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { days: -1 };
    case "ArrowRight":
      return { days: 1 };
    case "ArrowUp":
      return { days: -WEEK_LENGTH };
    case "ArrowDown":
      return { days: WEEK_LENGTH };
    case "Home":
      return { days: -(index % WEEK_LENGTH) };
    case "End":
      return { days: WEEK_LENGTH - 1 - (index % WEEK_LENGTH) };
    case "PageUp":
      return { months: -1 };
    case "PageDown":
      return { months: 1 };
    default:
      return null;
  }
}

/** The same day of the month `n` months away, or that month's last day when it is shorter. */
export function sameDayIn(date: LocalDate, n: number): LocalDate {
  const month = addMonths(monthOf(date), n);
  const lastDay = Number(addDays(firstOf(addMonths(month, 1)), -1).slice(8));
  return `${month}-${String(Math.min(Number(date.slice(8)), lastDay)).padStart(2, "0")}` as LocalDate;
}

/** The day the grid focuses first: today in this month, else the 1st. */
export function anchorOf(month: YearMonth, today: LocalDate): LocalDate {
  return monthOf(today) === month ? today : firstOf(month);
}
