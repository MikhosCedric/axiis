import type { AreaId, Item, ItemId, ItemType } from "@/domain/item";
import { toLocalDate } from "@/lib/dates";
import type { ActionResult } from "@/features/today/commands";
import { formatClock } from "@/features/today/format";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";

export type Created = { ok: true; id: string } | { ok: false; error: string };

/** A note in the list, formatted for the user's zone. */
export type NoteRow = { id: ItemId; title: string; firstLine: string; areaName: string | null; edited: string };

/** An item on the other end of a link. `backlink` means the link was made from that item. */
export type ConnectedRow = {
  linkId: string;
  id: ItemId;
  type: ItemType;
  title: string;
  done: boolean;
  backlink: boolean;
  href: string;
};

export type SearchRow = { id: ItemId; type: ItemType; title: string; snippet: string; done: boolean; href: string };

/** Everything the note screen draws, serializable to the client. */
export type NoteView = {
  note: { id: ItemId; title: string; body: unknown | null; areaId: AreaId | null };
  edited: string;
  areas: { id: AreaId; name: string }[];
  connected: ConnectedRow[];
};

/** The writes the notes screens make. Server actions in the app, in-memory fakes in the dev harness. */
export type NotesActions = {
  create: () => Promise<Created>;
  save: (id: string, content: { title: string; body: unknown }) => Promise<ActionResult>;
  setArea: (id: string, areaId: string | null) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  search: (query: string) => Promise<SearchRow[]>;
  link: (fromId: string, toId: string) => Promise<ActionResult>;
  unlink: (linkId: string) => Promise<ActionResult>;
};

export const UNTITLED = "Untitled note";

export const TYPE_WORD: Record<ItemType, string> = { task: "Task", event: "Event", note: "Note", checklist: "Checklist" };

export function displayTitle(item: { type: ItemType; title: string }): string {
  return item.title.trim() || (item.type === "note" ? UNTITLED : "Untitled");
}

/** Where an item opens: a note in its editor, anything else in the Today detail panel. */
export function hrefFor(item: { id: ItemId; type: ItemType }): string {
  return item.type === "note" ? `/notes/${item.id}` : `/today?${SELECTED_ITEM_PARAM}=${item.id}`;
}

export function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

const dayMonth = new Map<string, Intl.DateTimeFormat>();
function dateFormat(timeZone: string, withYear: boolean) {
  const key = `${timeZone}|${withYear}`;
  let f = dayMonth.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(withYear && { year: "numeric" }), timeZone });
    dayMonth.set(key, f);
  }
  return f;
}

/** "Edited today, 14:05", "Edited 3 Oct", or "Edited 3 Oct 2025" for another year, in the user's zone. */
export function formatEdited(at: Date, now: Date, timeZone: string): string {
  const day = toLocalDate(at, timeZone);
  const today = toLocalDate(now, timeZone);
  if (day === today) return `Edited today, ${formatClock(at, timeZone)}`;
  return `Edited ${dateFormat(timeZone, day.slice(0, 4) !== today.slice(0, 4)).format(at)}`;
}

export function connectedRow(link: { linkId: string; direction: "outgoing" | "incoming"; item: Item }): ConnectedRow {
  const { item } = link;
  return {
    linkId: link.linkId,
    id: item.id,
    type: item.type,
    title: displayTitle(item),
    done: item.status === "done",
    backlink: link.direction === "incoming",
    href: hrefFor(item),
  };
}
