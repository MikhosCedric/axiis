import type { ItemType, LocalDate, ShownItem } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { toLocalDate, wallMinutes } from "@/lib/dates";
import type { QuickItem } from "./model";

// Kept apart from the model, which the layout loads on every page: these read dates and keys,
// and only the views that draw items need them.

export function quickItem(item: ShownItem, timeZone: string): QuickItem {
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
    subtask: item.parentId !== null,
  };
}

/** A note on its own row: no day, no series. */
export function quickNote(note: { id: string; title: string; areaId?: string | null }): QuickItem {
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
    subtask: false,
  };
}

/** A Month mark: one line of a day cell, which knows its day only when it is planned to start there. */
export function quickMark(
  mark: { key: string; occurrence: string | null; title: string; type: ItemType; state: string; repeats: boolean; movable: boolean },
  on: LocalDate,
): QuickItem {
  return {
    key: mark.key,
    title: mark.title,
    type: mark.type,
    done: mark.state === "done",
    series: mark.repeats ? "occurrence" : "none",
    occurrence: mark.occurrence ?? (mark.key.includes("~") ? mark.key : null),
    day: mark.movable ? on : null,
    time: null,
    areaId: null,
    subtask: false,
  };
}
