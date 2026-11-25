import type { LocalDate } from "@/domain/item";
import { formatClock, type Clock } from "@/lib/clock";
import type { TodayView } from "@/features/today/model";
import { dayGlance } from "./glance";

/** Rows the desktop tray menu shows for Today: the day in one line, then what is next, at most this many in all. */
const TRAY_ROWS = 4;
const TITLE_MAX = 48;

const clip = (text: string) => (text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text);

/** One tray line, and the item it opens (`null` for the day's own line, which only shows the window). */
export type TrayRow = { label: string; id: string | null };

/**
 * What the desktop tray shows for today, as plain lines: "Today · 3 of 8 done", then "16:00  Design sync" for what
 * comes next, each with the item it opens. Only the desktop shell reads it, so a day with nothing planned gives no rows
 * and leaves the menu alone.
 */
export function trayRows(view: TodayView, today: LocalDate, now: Date, timeZone: string, clock: Clock): TrayRow[] {
  const glance = dayGlance(view, today, today, now);
  if (glance.total === 0) return [];
  const at = (d: Date) => formatClock(d, timeZone, clock);
  const next = glance.next.slice(0, TRAY_ROWS - 1).map(({ item }) => {
    const s = item.schedule;
    const label = s.kind === "timed" ? `${at(s.start)}  ${clip(item.title)}` : clip(item.title);
    return { label, id: String(item.id) };
  });
  return [{ label: `Today · ${glance.done} of ${glance.total} done`, id: null }, ...next];
}
