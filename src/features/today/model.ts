import type { AreaId, DayRange, Item } from "@/domain/item";

/** How an item reads on the day: dashed planned, solid live beam, hollow done. */
export type BeamState = "planned" | "live" | "done";

export type TodayEntry = { item: Item; state: BeamState };

export type TodayView = {
  /** Day-only items first, then timed items in start order. */
  scheduled: TodayEntry[];
  /** Open unscheduled items, plus ones finished today so a mistaken tick can be undone. */
  waiting: TodayEntry[];
};

export function stateOf(item: Item, now: Date): BeamState {
  if (item.status === "done") return "done";
  const s = item.schedule;
  if (s.kind === "timed" && s.start <= now && now < s.end) return "live";
  return "planned";
}

const DAY_FIRST = (a: Item, b: Item) => {
  const sa = a.schedule;
  const sb = b.schedule;
  if (sa.kind === "timed" && sb.kind === "timed") {
    return sa.start.getTime() - sb.start.getTime() || sa.end.getTime() - sb.end.getTime() || a.title.localeCompare(b.title);
  }
  if (sa.kind === "timed") return 1;
  if (sb.kind === "timed") return -1;
  return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime();
};

const NEWEST_FIRST = (a: Item, b: Item) => b.createdAt.getTime() - a.createdAt.getTime();

const shown = (i: Item) => i.type !== "note" && i.status !== "dropped";

export function buildToday(
  items: { scheduled: Item[]; unscheduled: Item[] },
  range: DayRange,
  now: Date,
): TodayView {
  const finishedToday = (i: Item) => i.completedAt !== null && range.from <= i.completedAt && i.completedAt < range.to;
  const entry = (item: Item): TodayEntry => ({ item, state: stateOf(item, now) });
  return {
    scheduled: items.scheduled.filter(shown).sort(DAY_FIRST).map(entry),
    waiting: items.unscheduled
      .filter((i) => shown(i) && (i.status === "open" || finishedToday(i)))
      .sort(NEWEST_FIRST)
      .map(entry),
  };
}

export function summaryLine({ scheduled, waiting }: TodayView): string {
  const open = scheduled.filter((e) => e.state !== "done").length;
  const done = scheduled.length - open;
  const waitingOpen = waiting.filter((e) => e.state !== "done").length;
  if (scheduled.length === 0 && waitingOpen === 0) return "Nothing planned yet.";
  const plan =
    scheduled.length === 0
      ? "Nothing has a time today"
      : open === 0
        ? "Everything planned for today is done"
        : `${open} open${done ? `, ${done} done` : ""} today`;
  return waitingOpen ? `${plan}. ${waitingOpen} waiting for a time.` : `${plan}.`;
}

/** Open items per area across the day, for the nav's extent bars. */
export function openByArea({ scheduled, waiting }: TodayView): Map<AreaId, number> {
  const counts = new Map<AreaId, number>();
  for (const { item, state } of [...scheduled, ...waiting]) {
    if (state === "done" || item.areaId === null) continue;
    counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
  }
  return counts;
}
