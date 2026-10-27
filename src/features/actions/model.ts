import type { ItemType, LocalDate, ShownItem } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { toLocalDate, wallMinutes } from "@/lib/dates";

/**
 * What the quick actions need to know about something drawn on a row, a beam,
 * a chip or a mark. Every view builds one from what it already holds.
 */
export type QuickItem = {
  /** What the commands take: a stored id, or the occurrence key of a series' occurrence not stored yet. */
  key: string;
  title: string;
  type: ItemType;
  done: boolean;
  /** "series" is the series' own row (Lists, a tag's page, Search); "occurrence" is one time it happens, stored or not. */
  series: "none" | "series" | "occurrence";
  /** The occurrence key for one time a series happens, which a skip is undone by. */
  occurrence: string | null;
  day: LocalDate | null;
  /** Wall-clock minutes of its start and its length, when it has a time. */
  time: { start: number; length: number } | null;
  areaId: string | null;
  tags: readonly string[];
  subtask: boolean;
};

export function quickItem(item: ShownItem, timeZone: string, tags: readonly string[] = []): QuickItem {
  const r = item.recurrence;
  const s = item.schedule;
  const day = s.kind === "day" ? s.on : s.kind === "timed" ? toLocalDate(s.start, timeZone) : r.kind === "override" || r.kind === "occurrence" ? r.originalOn : null;
  return {
    key: item.id,
    title: item.title,
    type: item.type,
    done: item.status === "done",
    series: r.kind === "series" ? "series" : r.kind === "none" ? "none" : "occurrence",
    occurrence: r.kind === "override" || r.kind === "occurrence" ? occurrenceKey(r.seriesId, r.originalOn) : null,
    day,
    time:
      s.kind === "timed"
        ? { start: wallMinutes(s.start, timeZone), length: Math.round((s.end.getTime() - s.start.getTime()) / 60000) }
        : null,
    areaId: item.areaId,
    tags,
    subtask: item.parentId !== null,
  };
}

/** A note on its own row: no day, no series. */
export function quickNote(note: { id: string; title: string; areaId?: string | null; tags?: readonly string[] }): QuickItem {
  return {
    key: note.id,
    title: note.title,
    type: "note",
    done: false,
    series: "none",
    occurrence: null,
    day: null,
    time: null,
    areaId: note.areaId ?? null,
    tags: note.tags ?? [],
    subtask: false,
  };
}

/** The buttons a cluster holds, in the order drawn. */
export type QuickAction = "done" | "rename" | "plan" | "labels" | "delete" | "more";

export const CLUSTER_ORDER: readonly QuickAction[] = ["done", "rename", "plan", "labels", "delete", "more"];

/** What can be done to this item from its row. A note has no day and no done box; a series' own row moves by its first day, in the panel. */
export function canDo(item: QuickItem, action: QuickAction): boolean {
  if (action === "done") return item.type !== "note";
  if (action === "plan") return item.type !== "note" && item.series !== "series";
  return true;
}

/** The More menu's entries, in order. */
export type MoreEntry = "duplicate" | "make-event" | "make-task" | "inbox" | "delete-all" | "open";

export function moreEntries(item: QuickItem): MoreEntry[] {
  const retypable = item.type !== "note" && !item.subtask;
  return [
    "duplicate",
    ...(retypable && item.type !== "event" ? (["make-event"] as const) : []),
    ...(retypable && item.type === "event" ? (["make-task"] as const) : []),
    ...(item.type !== "note" && item.series === "none" && item.day !== null ? (["inbox"] as const) : []),
    ...(item.series === "occurrence" ? (["delete-all"] as const) : []),
    "open",
  ];
}

/**
 * How Delete goes: at once with Undo, or after a question. One time a series
 * happens asks whether to skip that day or delete every time; a series' own
 * row asks before it takes every time with it.
 */
export function deleteKind(item: QuickItem): "now" | "ask-occurrence" | "ask-series" {
  if (item.series === "occurrence") return "ask-occurrence";
  if (item.series === "series") return "ask-series";
  return "now";
}

/** A key pressed on a row in focus, as the row sees it. */
export type RowPress = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  typing: boolean;
  defaultPrevented: boolean;
  /** G or A was pressed just before, so this key belongs to that sequence. */
  sequence: boolean;
};

/**
 * The action a key asks for on a row in focus: E renames, P plans, D ticks,
 * Delete or Backspace deletes, `.` opens More (as do the menu key and Shift
 * F10). `deletes` is false where those keys already mean something else (the
 * Score and the Week send an item back to the Inbox with them).
 */
export function rowKeyAction(press: RowPress, deletes = true): QuickAction | null {
  if (press.typing || press.defaultPrevented || press.sequence || press.altKey || press.ctrlKey || press.metaKey) return null;
  if (press.key === "ContextMenu" || (press.shiftKey && press.key === "F10")) return "more";
  if (press.shiftKey) return null;
  switch (press.key.toLowerCase()) {
    case "e":
      return "rename";
    case "p":
      return "plan";
    case "d":
      return "done";
    case ".":
      return "more";
    case "delete":
    case "backspace":
      return deletes ? "delete" : null;
    default:
      return null;
  }
}

/**
 * Where focus goes in a menu of `labels` after a key, from `at`, or null when
 * the key is not the menu's: arrows wrap, Home and End go to the ends, and a
 * letter goes to the next entry starting with it.
 */
export function menuStep(key: string, at: number, labels: readonly string[]): number | null {
  const n = labels.length;
  if (n === 0) return null;
  if (key === "ArrowDown") return (at + 1) % n;
  if (key === "ArrowUp") return (at - 1 + n) % n;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  if (key.length !== 1 || !/\S/.test(key)) return null;
  const letter = key.toLowerCase();
  for (let i = 1; i <= n; i++) {
    const j = (at + i) % n;
    if (labels[j].toLowerCase().startsWith(letter)) return j;
  }
  return null;
}

export type Box = { left: number; top: number; width: number; height: number };

/**
 * Where a floating layer of `size` goes beside `anchor` in a window of `view`:
 * under it, its left edges lined up, flipped above when it does not fit below,
 * and held `margin` inside the window. A point anchor (a right-click) has no size.
 */
export function placeNear(
  anchor: Box,
  size: { width: number; height: number },
  view: { width: number; height: number },
  gap = 4,
  margin = 16,
): { left: number; top: number } {
  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - size.height;
  const top = below + size.height <= view.height - margin || above < margin ? below : above;
  const left = Math.min(anchor.left, view.width - margin - size.width);
  return {
    left: Math.max(margin, left),
    top: Math.max(margin, Math.min(top, view.height - margin - size.height)),
  };
}
