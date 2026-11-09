import type { TodayView } from "@/features/today/model";

/** What the desktop shell is told about, at most: more than a day holds is a day nobody planned. */
export const REMINDER_MAX = 20;
const TITLE_MAX = 80;

export type ReminderRow = { id: string; at: number; title: string };

/**
 * The open items still to start today, soonest first, as plain rows for the desktop shell to notify from. The page
 * only reports; the shell decides when to speak and never runs anything the page sends.
 */
export function reminderRows(view: TodayView, now: Date): ReminderRow[] {
  return view.scheduled
    .flatMap(({ item, state }) => {
      const s = item.schedule;
      if (s.kind !== "timed" || state !== "planned" || item.status !== "open" || s.start <= now) return [];
      const title = item.title.length > TITLE_MAX ? `${item.title.slice(0, TITLE_MAX - 1)}…` : item.title;
      return [{ id: String(item.id), at: s.start.getTime(), title }];
    })
    .sort((a, b) => a.at - b.at)
    .slice(0, REMINDER_MAX);
}
