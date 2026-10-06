import type { ShownItem, ItemPatch, LocalDate, Schedule, SpanRange } from "@/domain/item";
import { buildToday, type TodayEntry } from "@/features/today/model";
import { addDays, dayRangeFor, instantAt, localMinutes, toLocalDate } from "@/lib/dates";

/** First day of the week, as `Date#getUTCDay` numbers it (0 is Sunday). One place, so it can become a setting. */
export const WEEK_STARTS_ON = 1;
export const WEEK_LENGTH = 7;

/** The seven local dates of the week that holds `date`, first day first. */
export function weekOf(date: LocalDate): LocalDate[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -((weekday - WEEK_STARTS_ON + WEEK_LENGTH) % WEEK_LENGTH));
  return Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(start, i));
}

/** The span `repo.listRange` reads for `days`: local midnight of the first day to local midnight after the last. */
export function weekRange(days: LocalDate[], timeZone: string): SpanRange {
  const first = days[0];
  const last = days[days.length - 1];
  return {
    from: dayRangeFor(first, timeZone).from,
    to: dayRangeFor(last, timeZone).to,
    fromDate: first,
    toDate: addDays(last, 1),
  };
}

/** The local date an item is planned for: a timed item by its start, a day-only item by its date. */
export function dayOf(item: ShownItem, timeZone: string): LocalDate | null {
  const s = item.schedule;
  if (s.kind === "timed") return toLocalDate(s.start, timeZone);
  if (s.kind === "day") return s.on;
  return null;
}

export type WeekDay = { date: LocalDate; entries: TodayEntry[] };

/**
 * Scheduled items sorted into their days. Each day lists its "any time" items
 * first, then timed items by start, with the same filtering as the day view.
 * Items whose day is outside `days` are left out.
 */
export function bucketWeek(items: ShownItem[], days: LocalDate[], timeZone: string, now: Date): WeekDay[] {
  const byDay = new Map<LocalDate, ShownItem[]>(days.map((d) => [d, []]));
  for (const item of items) {
    const day = dayOf(item, timeZone);
    if (day) byDay.get(day)?.push(item);
  }
  return days.map((date) => ({
    date,
    entries: buildToday({ scheduled: byDay.get(date)!, unscheduled: [] }, dayRangeFor(date, timeZone), now).scheduled,
  }));
}

/** Where an item can be sent on the week: a day, or back to the tray. */
export type Destination = LocalDate | "tray";

/** A move only ever changes the schedule. */
export type SchedulePatch = ItemPatch & { schedule: Schedule };

/**
 * The schedule an item gets on `target`. A timed item keeps its local start
 * and wall-clock length, so 09:00 to 10:30 stays 09:00 to 10:30 across a DST
 * change. A day-only item stays day-only; an unscheduled item becomes day-only.
 */
export function moveToDay(item: ShownItem, target: LocalDate, timeZone: string): SchedulePatch {
  const s = item.schedule;
  if (s.kind !== "timed") return { schedule: { kind: "day", on: target } };
  const from = toLocalDate(s.start, timeZone);
  const start = localMinutes(s.start, from, timeZone);
  const end = localMinutes(s.end, from, timeZone);
  return { schedule: { kind: "timed", start: instantAt(target, start, timeZone), end: instantAt(target, end, timeZone) } };
}

export function moveTo(item: ShownItem, to: Destination, timeZone: string): SchedulePatch {
  return to === "tray" ? { schedule: { kind: "unscheduled" } } : moveToDay(item, to, timeZone);
}

/** Whether sending `item` to `to` would change where it sits. */
export function moves(item: ShownItem, to: Destination, timeZone: string): boolean {
  return to === "tray" ? item.schedule.kind !== "unscheduled" : dayOf(item, timeZone) !== to;
}

/** The day a waiting item gets from the keyboard: today when it is in the week, else the first day. */
export function anchorDay(days: LocalDate[], today: LocalDate): LocalDate {
  return days.includes(today) ? today : days[0];
}

/**
 * Where a key press sends a focused item, or null when the key means nothing
 * here or would leave the week. On a day: left and right step a day,
 * Backspace or Delete return it to the tray. In the tray: up gives it a day.
 */
export function keyDestination(item: ShownItem, days: LocalDate[], today: LocalDate, timeZone: string, key: string): Destination | null {
  const day = dayOf(item, timeZone);
  if (day === null) return key === "ArrowUp" ? anchorDay(days, today) : null;
  if (key === "Backspace" || key === "Delete") return "tray";
  const step = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (step === 0) return null;
  const i = days.indexOf(day);
  return i < 0 ? null : (days[i + step] ?? null);
}

/** Read a drop zone's `data-drop` value. Anything unrecognised is no target. */
export function readDropZone(raw: string | undefined, days: LocalDate[]): Destination | null {
  if (raw === "tray") return "tray";
  return days.find((d) => d === raw) ?? null;
}

export function weekSummary(week: WeekDay[], waiting: TodayEntry[]): string {
  const open = week.reduce((n, d) => n + d.entries.filter((e) => e.state !== "done").length, 0);
  const waitingOpen = waiting.filter((e) => e.state !== "done").length;
  const plan = open === 0 ? "Nothing open across the week" : `${open} open across the week`;
  return waitingOpen ? `${plan}. ${waitingOpen} waiting.` : `${plan}.`;
}

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const noon = (d: LocalDate) => new Date(`${d}T12:00:00Z`);

/** "5 to 11 October", "28 September to 4 October", or with years when the week crosses one. */
export function formatWeekHeading(days: LocalDate[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  const [fy, fm] = first.split("-");
  const [ly, lm] = last.split("-");
  if (fy !== ly) return `${dayMonth.format(noon(first))} ${fy} to ${dayMonth.format(noon(last))} ${ly}`;
  if (fm !== lm) return `${dayMonth.format(noon(first))} to ${dayMonth.format(noon(last))}`;
  return `${Number(first.slice(8))} to ${dayMonth.format(noon(last))}`;
}

/** "Week of 5 October 2026", for the document title. */
export function weekTitle(days: LocalDate[]): string {
  return `Week of ${dayMonth.format(noon(days[0]))} ${days[0].slice(0, 4)}`;
}

const short = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

/** "Mon" and "Monday" for a column heading. */
export function weekdayName(date: LocalDate, form: "short" | "long"): string {
  return (form === "short" ? short : long).format(noon(date));
}

/** `/week` for the week holding today, `/week/<first day>` for any other. Any selection is dropped. */
export function weekHref(date: LocalDate, today: LocalDate): string {
  const start = weekOf(date)[0];
  return start === weekOf(today)[0] ? "/week" : `/week/${start}`;
}

export type WeekNavAction = "previous" | "next" | "today";

/** A date in the week the action leads to. */
export function weekNavTarget(action: WeekNavAction, date: LocalDate, today: LocalDate): LocalDate {
  if (action === "today") return today;
  return addDays(weekOf(date)[0], action === "next" ? WEEK_LENGTH : -WEEK_LENGTH);
}
