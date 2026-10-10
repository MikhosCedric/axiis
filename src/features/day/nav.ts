import type { LocalDate } from "@/domain/item";
import { parseItemKey } from "@/domain/item-key";
import { formatDayHeading, yearOf } from "@/features/today/format";
import { addDays } from "@/lib/dates";
import { DAY_VIEW_PARAM, SELECTED_ITEM_PARAM, type DayViewMode } from "./types";

/** Today lives at `/today` so the address stays stable; other days at `/day/<date>`. Any selection is dropped. */
export function dayHref(date: LocalDate, today: LocalDate, mode: DayViewMode): string {
  const path = date === today ? "/today" : `/day/${date}`;
  return mode === "list" ? `${path}?${DAY_VIEW_PARAM}=list` : path;
}

export type DayQuery = { mode: DayViewMode; itemId: string | null };

export function readDayQuery(query: Record<string, string | string[] | undefined>): DayQuery {
  const item = query[SELECTED_ITEM_PARAM];
  return {
    mode: query[DAY_VIEW_PARAM] === "list" ? "list" : "score",
    itemId: parseItemKey(item) ? (item as string) : null,
  };
}

export type DayNavAction = "previous" | "next" | "today";

export function navTarget(action: DayNavAction, date: LocalDate, today: LocalDate): LocalDate {
  if (action === "today") return today;
  return addDays(date, action === "next" ? 1 : -1);
}

export type KeyPress = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  /** Focus is in a text field or editable content. */
  typing: boolean;
};

const SHORTCUTS: Record<string, DayNavAction> = { "[": "previous", "]": "next", t: "today", T: "today" };

export function shortcutAction(e: KeyPress): DayNavAction | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.defaultPrevented || e.typing) return null;
  return SHORTCUTS[e.key] ?? null;
}

export function isTypingTarget(el: { tagName: string; isContentEditable: boolean } | null): boolean {
  return el !== null && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** "Tuesday 6 October 2026", for the document title. */
export function dayTitle(date: LocalDate): string {
  return `${formatDayHeading(date)} ${yearOf(date)}`;
}
