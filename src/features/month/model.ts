import type { AreaColor } from "@/domain/area-color";
import { repeats, type Area, type ItemType, type LocalDate, type ShownItem, type SpanRange } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { stateOf, type BeamState } from "@/features/today/model";
import { formatClock, formatMinutes, type Clock } from "@/lib/clock";
import { WEEK_LENGTH, WEEK_STARTS_ON, weekOf, type WeekStart } from "@/features/week/model";
import { addDays, dayRangeFor, FIRST_DATE, LAST_DATE, localMinutes, toLocalDate } from "@/lib/dates";
import { RANGE_LIMIT } from "@/lib/items/repo";
import { spanLine } from "@/features/day/glance";

/** A calendar month, `YYYY-MM`. */
export type YearMonth = string & { readonly __brand: "YearMonth" };

export const MONTH_PATH = "/month";

/**
 * Most marks one day sends to the page. The rest are a count, and the day itself lists them. The page draws as many
 * of these as its cells have room for (a tall window shows more), so this is the most a cell can ever show.
 */
export const MARKS_PER_DAY = 10;

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
const MIN_WEEKS = 5;

/**
 * The days the grid draws: whole weeks from the week start on or before the
 * 1st through the week holding the last day, five or six of them.
 */
export function monthGrid(month: YearMonth, startsOn: WeekStart = WEEK_STARTS_ON): LocalDate[] {
  const start = weekOf(firstOf(month), startsOn)[0];
  const last = addDays(firstOf(addMonths(month, 1)), -1);
  const end = weekOf(last, startsOn)[WEEK_LENGTH - 1];
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

/** Months in a row of the Jump to month picker. */
const PICKER_COLUMNS = 3;

/** Where a key press moves the month picker's focus, or null for any other key or a move past the span Axiis plans on. */
export function pickerStep(key: string, from: YearMonth): YearMonth | null {
  const year = from.slice(0, 4);
  const to: Record<string, YearMonth> = {
    ArrowLeft: addMonths(from, -1),
    ArrowRight: addMonths(from, 1),
    ArrowUp: addMonths(from, -PICKER_COLUMNS),
    ArrowDown: addMonths(from, PICKER_COLUMNS),
    PageUp: addMonths(from, -12),
    PageDown: addMonths(from, 12),
    Home: `${year}-01` as YearMonth,
    End: `${year}-12` as YearMonth,
  };
  return key in to ? parseYearMonth(to[key]) : null;
}

/** The same month `years` away, or the nearest month inside the span when that is past it. */
export function stepYear(month: YearMonth, years: number): YearMonth {
  const to = addMonths(month, years * 12);
  const first = monthOf(FIRST_DATE);
  const last = monthOf(LAST_DATE);
  return to < first ? first : to > last ? last : to;
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
  /** An override's occurrence key, which `?item=` still holds after a first change stored the occurrence. */
  occurrence: string | null;
  title: string;
  type: ItemType;
  state: BeamState;
  /** "09:30" or "9:30 AM" on the day it starts, "to 01:00" on a later day it runs into, null for a day-only or due mark. */
  time: string | null;
  area: string | null;
  areaColor: AreaColor | null;
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

type Placed = { mark: MonthMark; rank: [number, number, number] };

/**
 * Sorts planned and due items into the grid's days. A timed item shows on
 * every day it covers in the user's zone; a day-only item on its date; a due
 * date as a due mark, folded into the planned mark when both fall on one day.
 * Each day keeps day-only items first in area order, then timed by start,
 * then due-only marks, and sends at most `perDay` of them (`MARKS_PER_DAY` unless given).
 */
export function buildMonth(input: {
  month: YearMonth;
  days: readonly LocalDate[];
  scheduled: readonly ShownItem[];
  due: readonly ShownItem[];
  areas: readonly Area[];
  timeZone: string;
  clock: Clock;
  now: Date;
  perDay?: number;
}): MonthBuild {
  const { month, days, timeZone, clock, now, perDay = MARKS_PER_DAY } = input;
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
      occurrence: item.recurrence.kind === "override" ? occurrenceKey(item.recurrence.seriesId, item.recurrence.originalOn) : null,
      title: item.title,
      type: item.type,
      state: stateOf(item, now),
      area: area?.name ?? null,
      areaColor: area?.color ?? null,
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
      const time = starts ? formatMinutes(startMinutes, clock) : `to ${formatClock(s.end, timeZone, clock)}`;
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
    // Done marks go last, so the marks a day shows are what is still to do.
    const done = (p: Placed) => (p.mark.state === "done" ? 1 : 0);
    const placed = byDay
      .get(date)!
      .sort((a, b) => done(a) - done(b) || a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);
    return { date, marks: placed.slice(0, perDay).map((p) => p.mark), more: Math.max(0, placed.length - perDay) };
  });
  return { cells, open, due };
}

/** The key of the mark `selected` names: an override answers to its occurrence key too. Anything else passes through. */
export function selectedMarkKey(cells: readonly MonthCell[], selected: string | null): string | null {
  if (selected === null) return null;
  for (const cell of cells) for (const m of cell.marks) if (m.key === selected || m.occurrence === selected) return m.key;
  return selected;
}

/** Where the month stands: "28 open · 4 due". */
export function monthSummary(open: number, due: number, scope = ""): string {
  return spanLine({ open, due }, scope);
}

/** How many items a day holds, sent and counted. */
export const dayTotal = (cell: MonthCell) => cell.marks.length + cell.more;

/** How many marks a cell draws when its room is not measured (a phone, or before the page wakes). */
export const MARKS_UNMEASURED = 3;

/** How many marks a measured cell has room for: with nothing under them, and with a "+N more" line under them. */
export type CellRoom = { all: number; withMore: number };

/**
 * How many of a day's sent marks its cell draws, and the count its "+N more" says. Every mark fits when the day holds
 * no more than `room.all`; otherwise the cell keeps a line for "+N more" and draws `room.withMore`.
 */
export function fitMarks(cell: MonthCell, room: CellRoom | null): { shown: number; more: number } {
  const total = dayTotal(cell);
  const want = room === null ? MARKS_UNMEASURED : total <= room.all ? total : room.withMore;
  const shown = Math.max(0, Math.min(want, cell.marks.length));
  return { shown, more: total - shown };
}

/** The room a measured cell has: `space` px under the day's number, marks `pitch` px apart, "+N more" `moreLine` px tall. */
export function cellRoom(space: number, pitch: number, moreLine: number): CellRoom {
  // The last mark needs its height, not its gap below: one pitch less the gap fits one more mark exactly.
  const fits = (px: number) => Math.max(0, Math.floor((px + 1) / pitch));
  return { all: fits(space), withMore: fits(space - moreLine) };
}

/** "3 items", "1 item", "Nothing planned". */
export function countWords(n: number): string {
  return n === 0 ? "Nothing planned" : `${n} ${n === 1 ? "item" : "items"}`;
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
