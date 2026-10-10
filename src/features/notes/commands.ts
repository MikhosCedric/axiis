import { z } from "zod";
import { idSchema, type AreaId, type Item, type ItemId } from "@/domain/item";
import { sameTag, type TagName } from "@/domain/tag";
import type { ItemsRepo } from "@/lib/items/repo";
import type { LinkId, NotesRepo } from "@/lib/notes/repo";
import { parseItemId } from "@/features/detail/commands";
import { splitTagTerms } from "@/features/tags/model";
import type { ActionResult } from "@/features/today/commands";
import { SAVE_FAILED } from "./autosave";
import { NOTE_TITLE_MAX, parseBody } from "./doc";
import {
  connectedRow,
  displayTitle,
  firstLine,
  formatEdited,
  hrefFor,
  type ConnectedRow,
  type Created,
  type NoteRow,
  type NoteView,
  type SearchRow,
} from "./model";

const titleSchema = z
  .string()
  .max(NOTE_TITLE_MAX)
  .transform((s) => s.replace(/\s*\n\s*/g, " ").trim());
export const QUERY_MAX = 200;
const querySchema = z.string().trim().min(1).max(QUERY_MAX);

const MISSING = "That note is not here any more.";
const NOT_SAVED = SAVE_FAILED;
const TOO_LARGE = "This note is too long to save. Try splitting it in two.";

/** Parses a search box value, or null when there is nothing worth searching for. */
export function parseQuery(raw: unknown): string | null {
  const q = querySchema.safeParse(raw);
  return q.success ? q.data : null;
}

export async function listNoteRows(
  notes: NotesRepo,
  items: ItemsRepo,
  query: string | null,
  now: Date,
  timeZone: string,
): Promise<NoteRow[]> {
  const areas = new Map((await items.listAreas()).map((a) => [a.id as string, a.name]));
  const areaName = (id: AreaId | null) => (id && areas.get(id)) ?? null;
  if (query) {
    return (await notes.search(query, { type: "note" })).map(({ item, snippet }) => ({
      id: item.id,
      title: displayTitle(item),
      firstLine: snippet,
      areaName: areaName(item.areaId),
      edited: formatEdited(item.updatedAt, now, timeZone),
    }));
  }
  return (await notes.listNotes()).map((n) => ({
    id: n.id,
    title: displayTitle({ type: "note", title: n.title }),
    firstLine: firstLine(n.excerpt),
    areaName: areaName(n.areaId),
    edited: formatEdited(n.updatedAt, now, timeZone),
  }));
}

export async function loadNote(notes: NotesRepo, items: ItemsRepo, rawId: unknown, now: Date, timeZone: string): Promise<NoteView | null> {
  const id = parseItemId(rawId);
  if (!id) return null;
  const note = await notes.getNote(id);
  if (!note) return null;
  const [areas, links] = await Promise.all([items.listAreas(), notes.linksFor(id)]);
  return {
    note: { id: note.id, title: note.title, body: note.body, areaId: note.areaId },
    edited: formatEdited(note.updatedAt, now, timeZone),
    areas: areas.map((a) => ({ id: a.id, name: a.name })),
    connected: links.map(connectedRow),
  };
}

/** Notes linked to an item, in either direction, for the task detail panel. */
export async function linkedNotes(notes: NotesRepo, id: ItemId): Promise<ConnectedRow[]> {
  return (await notes.linksFor(id)).filter((l) => l.item.type === "note").map(connectedRow);
}

export async function createNote(notes: NotesRepo, rawAreaId: unknown = null): Promise<Created> {
  const areaId = idSchema.nullable().safeParse(rawAreaId);
  if (!areaId.success) return { ok: false, error: "That area could not be found." };
  try {
    const note = await notes.createNote({ title: "", areaId: areaId.data as AreaId | null });
    return { ok: true, id: note.id };
  } catch {
    return { ok: false, error: "A new note could not be made. Try again." };
  }
}

/** Saves title and body. The plain text for search is worked out here from the parsed body, never taken from the client. */
export async function saveNote(notes: NotesRepo, rawId: unknown, rawTitle: unknown, rawBody: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) return { ok: false, error: `A title can be up to ${NOTE_TITLE_MAX} characters.` };
  const body = parseBody(rawBody);
  if (!body.ok) return { ok: false, error: body.reason === "too-large" ? TOO_LARGE : NOT_SAVED };
  try {
    await notes.saveNote(id, { title: title.data, body: body.doc, bodyText: body.text });
    return { ok: true };
  } catch {
    return { ok: false, error: NOT_SAVED };
  }
}

/** The live items carrying every one of the tags, or none when a tag does not exist. */
async function carryingAll(items: ItemsRepo, names: readonly TagName[]): Promise<Item[]> {
  const all = await items.listTagNames();
  const tags = names.map((n) => all.find((t) => sameTag(t.name, n)));
  if (tags.some((t) => !t)) return [];
  const lists = await Promise.all(tags.map((t) => items.listTagged(t!.id)));
  const rest = lists.slice(1).map((l) => new Set(l.map((i) => i.id as string)));
  return lists[0].filter((i) => rest.every((ids) => ids.has(i.id)));
}

/**
 * Search across every item type, for the search page and the link picker.
 * `#name` words keep to items carrying that tag; an override of a tagged
 * series counts, since it wears the series' tags. With only tags, every item
 * carrying them is listed, most recently edited first like any search.
 */
export async function searchItems(notes: NotesRepo, items: ItemsRepo, rawQuery: unknown): Promise<SearchRow[]> {
  const query = parseQuery(rawQuery);
  if (!query) return [];
  const { text, tags } = splitTagTerms(query);
  const toRow = (item: Item, snippet: string): SearchRow => ({
    id: item.id,
    type: item.type,
    title: displayTitle(item),
    snippet,
    done: item.status === "done",
    href: hrefFor(item),
  });
  if (tags.length === 0) return (await notes.search(query)).map(({ item, snippet }) => toRow(item, snippet));

  const tagged = await carryingAll(items, tags);
  if (tagged.length === 0) return [];
  if (!text) return [...tagged].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map((i) => toRow(i, ""));
  const ids = new Set<string>(tagged.map((i) => i.id));
  const wears = (item: Item) => ids.has(item.id) || (item.recurrence.kind === "override" && ids.has(item.recurrence.seriesId));
  return (await notes.search(text)).filter(({ item }) => wears(item)).map(({ item, snippet }) => toRow(item, snippet));
}

/** Connects two items. Already connected, in either direction, counts as done. */
export async function linkItems(notes: NotesRepo, rawFrom: unknown, rawTo: unknown): Promise<ActionResult> {
  const from = parseItemId(rawFrom);
  const to = parseItemId(rawTo);
  if (!from || !to) return { ok: false, error: "That item could not be found." };
  if (from === to) return { ok: false, error: "A note cannot link to itself." };
  try {
    const existing = await notes.linksFor(from);
    if (!existing.some((l) => l.item.id === to)) await notes.link(from, to);
    return { ok: true };
  } catch {
    return { ok: false, error: "That link did not save. Try again." };
  }
}

export async function unlinkItems(notes: NotesRepo, rawLinkId: unknown): Promise<ActionResult> {
  const linkId = idSchema.safeParse(rawLinkId);
  if (!linkId.success) return { ok: false, error: "That link is not here any more." };
  try {
    await notes.unlink(linkId.data as LinkId);
    return { ok: true };
  } catch {
    return { ok: false, error: "That link could not be removed. Try again." };
  }
}

/** Makes an empty note in the item's area, linked from the note to the item. */
export async function createLinkedNote(notes: NotesRepo, items: ItemsRepo, rawItemId: unknown): Promise<Created> {
  const itemId = parseItemId(rawItemId);
  if (!itemId) return { ok: false, error: "That item is not here any more." };
  try {
    const item = await items.get(itemId);
    if (!item) return { ok: false, error: "That item is not here any more." };
    const note = await notes.createNote({ title: "", areaId: item.areaId });
    await notes.link(note.id, item.id);
    return { ok: true, id: note.id };
  } catch {
    return { ok: false, error: "A new note could not be made. Try again." };
  }
}
