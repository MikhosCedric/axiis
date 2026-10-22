import type { DayRange, ShownItem } from "@/domain/item";
import { WAITING_LIMIT } from "@/lib/items/repo";

export const TITLE_MAX = 500;

/**
 * The one name for the pile of open items with no day: the Inbox page, and the tray under the Score, the Week and the List.
 * Never "Waiting" or "unplanned" on screen. An item there is drawn with the dashed planned line.
 */
export const INBOX = "Inbox";

/** The tray with nothing in it. Things under "Any time" have a day, so this must not claim everything has one. */
export const EMPTY_TRAY = "The Inbox is empty. What you capture lands here first.";

/** Under a tray whose read hit `WAITING_LIMIT`, so older waiting items are not shown. */
export const TRAY_FULL = `Showing the newest ${WAITING_LIMIT} in the Inbox. Plan a few to see older ones.`;

/** How an item reads on the day: dashed planned, solid live beam, hollow done. */
export type BeamState = "planned" | "live" | "done";

export type TodayEntry = { item: ShownItem; state: BeamState };

export type TodayView = {
  /** Day-only items first, then timed items in start order. */
  scheduled: TodayEntry[];
  /** Open unscheduled items, plus ones finished today so a mistaken tick can be undone. */
  waiting: TodayEntry[];
};

export function stateOf(item: ShownItem, now: Date): BeamState {
  if (item.status === "done") return "done";
  const s = item.schedule;
  if (s.kind === "timed" && s.start <= now && now < s.end) return "live";
  return "planned";
}

const DAY_FIRST = (a: ShownItem, b: ShownItem) => {
  const sa = a.schedule;
  const sb = b.schedule;
  if (sa.kind === "timed" && sb.kind === "timed") {
    return sa.start.getTime() - sb.start.getTime() || sa.end.getTime() - sb.end.getTime() || a.title.localeCompare(b.title);
  }
  if (sa.kind === "timed") return 1;
  if (sb.kind === "timed") return -1;
  return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime();
};

const NEWEST_FIRST = (a: ShownItem, b: ShownItem) => b.createdAt.getTime() - a.createdAt.getTime();

const shown = (i: ShownItem) => i.type !== "note" && i.status !== "dropped";

export function buildToday(
  items: { scheduled: ShownItem[]; unscheduled: ShownItem[] },
  range: DayRange,
  now: Date,
): TodayView {
  const finishedToday = (i: ShownItem) => i.completedAt !== null && range.from <= i.completedAt && i.completedAt < range.to;
  const entry = (item: ShownItem): TodayEntry => ({ item, state: stateOf(item, now) });
  return {
    scheduled: items.scheduled.filter(shown).sort(DAY_FIRST).map(entry),
    waiting: items.unscheduled
      .filter((i) => shown(i) && (i.status === "open" || finishedToday(i)))
      .sort(NEWEST_FIRST)
      .map(entry),
  };
}
