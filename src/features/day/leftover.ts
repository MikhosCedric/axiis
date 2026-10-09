import type { LocalDate } from "@/domain/item";
import { displayTitle } from "@/features/notes/model";
import { formatDayIn } from "@/features/today/format";
import type { ActionResult } from "@/features/today/commands";
import { moveItem } from "@/features/week/commands";
import { dayRangeFor, toLocalDate } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import { LEFTOVER_SHOWN, type LeftoverData } from "./leftover-model";

/** One-off items planned for a day before today that are still open. Null when there are none. */
export async function loadLeftover(repo: ItemsRepo, today: LocalDate, timeZone: string): Promise<LeftoverData | null> {
  const items = await repo.listBehind(dayRangeFor(today, timeZone));
  if (items.length === 0) return null;
  return {
    total: items.length,
    rows: items.slice(0, LEFTOVER_SHOWN).map((item) => {
      const day = item.schedule.kind === "timed" ? toLocalDate(item.schedule.start, timeZone) : item.schedule.kind === "day" ? item.schedule.on : today;
      return { id: item.id, type: item.type, title: displayTitle(item), planned: `Planned ${formatDayIn(day, today)}` };
    }),
  };
}

const NOT_ALL = "Some of those could not be moved. Try again.";

/** Moves every item still open from earlier days to today: a day-only item stays day-only, a timed one keeps its time of day. Reports an error if any did not move. */
export async function moveLeftoverToToday(repo: ItemsRepo, now: Date, timeZone: string): Promise<ActionResult> {
  const today = toLocalDate(now, timeZone);
  try {
    const items = await repo.listBehind(dayRangeFor(today, timeZone));
    const results = await Promise.all(items.map((i) => moveItem(repo, i.id, today, timeZone)));
    return results.every((r) => r.ok) ? { ok: true } : { ok: false, error: NOT_ALL };
  } catch {
    return { ok: false, error: NOT_ALL };
  }
}
