import type { ItemId, ItemType, LocalDate } from "@/domain/item";
import { formatDayIn } from "@/features/today/format";

export const DUE_PATH = "/due";

/** Where a due date sits against today: already behind us, within the next week, or further off. */
export type DueGroup = "past" | "week" | "later";

/** One item on the Due page, already worded for the user's zone. */
export type DueRow = {
  id: ItemId;
  type: ItemType;
  title: string;
  done: boolean;
  dueOn: LocalDate;
  /** "Due Thursday 8 October", "Was due Monday 5 October", "Due today". */
  due: string;
  group: DueGroup;
  /** When it is planned, null when it has no day. */
  when: string | null;
  area: string | null;
};

/** Everything the Due page needs, loaded on the server and serializable to the client. */
export type DueData = {
  today: LocalDate;
  rows: DueRow[];
  /** The read hit its cap, so later due dates may not be shown. */
  full: boolean;
};

const DAY_MS = 86_400_000;
/** Days after today that still count as "this week": today and the six after it. */
const WEEK_DAYS = 7;

/** Whole days from `from` to `to`; negative when `to` is earlier. Dates are calendar dates, so no zone is involved. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function dueGroup(dueOn: LocalDate, today: LocalDate): DueGroup {
  const days = daysBetween(today, dueOn);
  if (days < 0) return "past";
  return days < WEEK_DAYS ? "week" : "later";
}

/** No label dates a debt: what is behind us is "Earlier", never "Past due" or "Overdue". */
export const GROUP_LABEL: Record<DueGroup, string> = { past: "Earlier", week: "This week", later: "Later" };

/** The due date in words. An open item behind us says "Was due", never more than that: no counting of days late. */
export function dueWords(dueOn: LocalDate, today: LocalDate, done: boolean): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return done ? "Was due today" : "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days < 0 && !done ? "Was due" : "Due"} ${formatDayIn(dueOn, today)}`;
}

/** The rows of one group, in the order they came. */
export function inGroup(rows: readonly DueRow[], group: DueGroup): DueRow[] {
  return rows.filter((r) => r.group === group);
}

export function dueSummary(rows: readonly Pick<DueRow, "done" | "group">[]): string {
  const open = rows.filter((r) => !r.done);
  if (rows.length === 0) return "Nothing has a due date.";
  if (open.length === 0) return "Everything with a due date is done.";
  const week = open.filter((r) => r.group === "week").length;
  const past = open.filter((r) => r.group === "past").length;
  const thisWeek = week === 0 ? (past > 0 ? "nothing due this week" : "Nothing is due this week") : `${week} ${week === 1 ? "is" : "are"} due this week`;
  return `${[...(past > 0 ? [`${past} past due`] : []), thisWeek].join(", ")}.`;
}
