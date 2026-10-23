import type { Area, Item, LocalDate } from "@/domain/item";
import type { TagColors, TagName } from "@/domain/tag";
import { formatDayHeading } from "@/features/today/format";
import { WEEK_LENGTH, weekOf } from "@/features/week/model";
import { addDays, parseLocalDate } from "@/lib/dates";
import type { ChildCount } from "@/lib/items/repo";

/** Everything the inbox needs, loaded on the server and serializable to the client. */
export type InboxData = {
  timeZone: string;
  today: LocalDate;
  areas: Area[];
  /** Open, unscheduled, top-level items, newest first. */
  items: Item[];
  childCounts: Record<string, ChildCount>;
  /** Tag names by item id. */
  tags: Record<string, TagName[]>;
  /** The colour of each coloured tag shown, by `tagKey`. */
  tagColors: TagColors;
  /** The read hit its cap, so older items may not be shown. */
  full: boolean;
};

/** The day a "Plan for" choice names: today, tomorrow, or a date picked by the user. */
export type PlanFor = "today" | "tomorrow" | LocalDate;

export function parsePlanFor(raw: unknown): PlanFor | null {
  if (raw === "today" || raw === "tomorrow") return raw;
  return parseLocalDate(raw);
}

export function planDate(when: PlanFor, today: LocalDate): LocalDate {
  if (when === "today") return today;
  if (when === "tomorrow") return addDays(today, 1);
  return when;
}

/** A one-tap choice under "Plan for", and the digit that makes it on the row in focus. */
export type QuickPlan = { key: "1" | "2" | "3"; label: string; when: PlanFor };

/** The digit that moves focus to the date field, for any other day. */
export const PICK_KEY = "4";

/** Today, Tomorrow, and the first day of next week, in that order. */
export function quickPlans(today: LocalDate): QuickPlan[] {
  return [
    { key: "1", label: "Today", when: "today" },
    { key: "2", label: "Tomorrow", when: "tomorrow" },
    { key: "3", label: "Next week", when: addDays(weekOf(today)[0], WEEK_LENGTH) },
  ];
}

/** What a key does on an Inbox row: move to the row below or above, plan it, or pick a day for it. */
export type RowKey = { move: 1 | -1 } | { plan: PlanFor } | { pick: true };

export function rowKey(key: string, today: LocalDate): RowKey | null {
  if (key === "j" || key === "ArrowDown") return { move: 1 };
  if (key === "k" || key === "ArrowUp") return { move: -1 };
  if (key === PICK_KEY) return { pick: true };
  const quick = quickPlans(today).find((q) => q.key === key);
  return quick ? { plan: quick.when } : null;
}

/** "today", "tomorrow" or "Thursday 8 October", for a sentence about where an item went. */
export function dayWords(date: LocalDate, today: LocalDate): string {
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return formatDayHeading(date);
}

/**
 * The rows the inbox shows: what the server sent, plus items ticked done on
 * this visit, so a mistaken tick can be undone. A ticked item reads as done
 * even before the server has dropped it from the list.
 */
export function inboxRows(saved: readonly Item[], doneHere: readonly Item[]): Item[] {
  const done = new Map(doneHere.map((i) => [i.id, i]));
  const rows = [...saved.map((i) => done.get(i.id) ?? i), ...doneHere.filter((i) => !saved.some((s) => s.id === i.id))];
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function inboxSummary(rows: readonly Item[]): string {
  const open = rows.filter((i) => i.status !== "done").length;
  if (open === 0) return rows.length ? "Everything here is done." : "Nothing here now.";
  return open === 1 ? "1 to plan." : `${open} to plan.`;
}
