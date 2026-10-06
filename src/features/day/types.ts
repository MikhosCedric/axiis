import type { Area, LocalDate } from "@/domain/item";
import type { ChildCount } from "@/lib/items/repo";
import type { TodayView as DayEntries } from "@/features/today/model";

/** URL query parameter that picks Score or List. Absent means Score. */
export const DAY_VIEW_PARAM = "view";
/** URL query parameter that selects an item for the detail panel. */
export const SELECTED_ITEM_PARAM = "item";

export type DayViewMode = "score" | "list";

/** Everything the day screen needs, loaded on the server and serializable to the client. */
export type DayData = {
  timeZone: string;
  date: LocalDate;
  isToday: boolean;
  /** The request's "now", as an ISO string, so server and client agree on which beam is live. */
  nowIso: string;
  areas: Area[];
  view: DayEntries;
  /** Subtask totals for the items shown, keyed by parent id. */
  childCounts: Record<string, ChildCount>;
  /** How often each live series repeats ("every day"), by series id. */
  cadences: Record<string, string>;
};
