import { describe, expect, it } from "vitest";
import type { AreaId, Item, ItemId } from "@/domain/item";
import { fakeNotesRepo, type NotesStore } from "@/lib/notes/fake";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import {
  createLinkedNote,
  createNote,
  linkedNotes,
  linkItems,
  listNoteRows,
  loadNote,
  saveNote,
  searchItems,
  unlinkItems,
} from "./commands";
import { BODY_MAX_BYTES } from "./doc";

const NOW = new Date("2026-10-06T12:00:00Z");
const TZ = "Europe/Lisbon";
const home = area("Home");

function world(items: Item[] = []) {
  const store: NotesStore = { items, bodyText: new Map(), links: [] };
  let tick = NOW.getTime();
  const notes = fakeNotesRepo(store, () => new Date((tick += 1000)));
  return { store, notes, items: fakeRepo(items, [home]).repo };
}

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("saveNote", () => {
  it("stores the title, the body and plain text worked out from the body", async () => {
    const w = world();
    const created = await createNote(w.notes);
    if (!created.ok) throw new Error(created.error);
    expect(await saveNote(w.notes, created.id, "  Garden\nplan ", doc("Plant tulips"))).toEqual({ ok: true });
    const note = await w.notes.getNote(created.id as ItemId);
    expect(note).toMatchObject({ title: "Garden plan", body: doc("Plant tulips"), bodyText: "Plant tulips" });
  });

  it("refuses an oversized body without saving anything", async () => {
    const w = world();
    const created = await createNote(w.notes);
    if (!created.ok) throw new Error(created.error);
    const result = await saveNote(w.notes, created.id, "Big", doc("a".repeat(BODY_MAX_BYTES)));
    expect(result).toEqual({ ok: false, error: "This note is too long to save. Try splitting it in two." });
    expect((await w.notes.getNote(created.id as ItemId))?.title).toBe("");
  });

  it("refuses a title over 500 characters and a body that is not a document", async () => {
    const w = world();
    const created = await createNote(w.notes);
    if (!created.ok) throw new Error(created.error);
    expect((await saveNote(w.notes, created.id, "x".repeat(501), doc("a"))).ok).toBe(false);
    expect((await saveNote(w.notes, created.id, "ok", "<p>hi</p>")).ok).toBe(false);
    expect((await saveNote(w.notes, "not-an-id", "ok", doc("a"))).ok).toBe(false);
  });

  it("reports a failed write as something to try again", async () => {
    const w = world();
    expect(await saveNote(w.notes, "00000000-0000-4000-8000-0000000000ff", "x", doc("a"))).toEqual({
      ok: false,
      error: "That did not save. Try again.",
    });
  });
});

describe("listNoteRows", () => {
  it("lists notes newest edit first with first line, area and edit time", async () => {
    const older = makeItem({ type: "note", title: "Older", areaId: home.id, updatedAt: new Date("2026-09-30T09:00:00Z") });
    const newer = makeItem({ type: "note", title: "", updatedAt: new Date("2026-10-06T10:05:00Z") });
    const task = makeItem({ title: "A task" });
    const w = world([older, newer, task]);
    w.store.bodyText.set(older.id, "\nFirst line\nsecond line");
    const rows = await listNoteRows(w.notes, w.items, null, NOW, TZ);
    expect(rows).toEqual([
      { id: newer.id, title: "Untitled note", firstLine: "", areaName: null, edited: "Edited today, 11:05" },
      { id: older.id, title: "Older", firstLine: "First line", areaName: "Home", edited: "Edited 30 Sept" },
    ]);
  });

  it("filters to notes that match a search", async () => {
    const garden = makeItem({ type: "note", title: "Garden" });
    const w = world([garden, makeItem({ type: "note", title: "Trip" }), makeItem({ title: "Garden task" })]);
    const rows = await listNoteRows(w.notes, w.items, "garden", NOW, TZ);
    expect(rows.map((r) => r.id)).toEqual([garden.id]);
  });
});

describe("links", () => {
  it("links two items once, whichever way round they were linked", async () => {
    const note = makeItem({ type: "note", title: "N" });
    const task = makeItem({ title: "T" });
    const w = world([note, task]);
    expect(await linkItems(w.notes, note.id, task.id)).toEqual({ ok: true });
    expect(await linkItems(w.notes, note.id, task.id)).toEqual({ ok: true });
    expect(await linkItems(w.notes, task.id, note.id)).toEqual({ ok: true });
    expect(w.store.links).toHaveLength(1);
  });

  it("refuses to link an item to itself", async () => {
    const note = makeItem({ type: "note" });
    const w = world([note]);
    expect(await linkItems(w.notes, note.id, note.id)).toEqual({ ok: false, error: "A note cannot link to itself." });
    expect(w.store.links).toHaveLength(0);
  });

  it("shows a link from another item as a backlink, and not after it is removed", async () => {
    const note = makeItem({ type: "note", title: "Garden" });
    const other = makeItem({ type: "note", title: "Bulbs" });
    const task = makeItem({ title: "Buy compost", status: "done" });
    const w = world([note, other, task]);
    await linkItems(w.notes, note.id, task.id);
    await linkItems(w.notes, other.id, note.id);
    const view = await loadNote(w.notes, w.items, note.id, NOW, TZ);
    expect(view?.connected).toEqual([
      expect.objectContaining({ id: task.id, title: "Buy compost", done: true, backlink: false, href: `/today?item=${task.id}` }),
      expect.objectContaining({ id: other.id, title: "Bulbs", backlink: true, href: `/notes/${other.id}` }),
    ]);
    await unlinkItems(w.notes, view?.connected[1].linkId);
    expect((await loadNote(w.notes, w.items, note.id, NOW, TZ))?.connected.map((c) => c.id)).toEqual([task.id]);
  });

  it("hides links to deleted items", async () => {
    const note = makeItem({ type: "note" });
    const task = makeItem({ title: "T" });
    const w = world([note, task]);
    await linkItems(w.notes, note.id, task.id);
    w.store.items.splice(w.store.items.indexOf(task), 1);
    expect((await loadNote(w.notes, w.items, note.id, NOW, TZ))?.connected).toEqual([]);
  });
});

describe("createLinkedNote", () => {
  it("makes a note in the task's area, linked to the task, listed among the task's notes", async () => {
    const task = makeItem({ title: "Plan trip", areaId: home.id as AreaId });
    const w = world([task]);
    const created = await createLinkedNote(w.notes, w.items, task.id);
    if (!created.ok) throw new Error(created.error);
    expect(await w.notes.getNote(created.id as ItemId)).toMatchObject({ areaId: home.id, title: "" });
    expect((await linkedNotes(w.notes, task.id)).map((n) => [n.id, n.backlink])).toEqual([[created.id, true]]);
  });

  it("only lists notes among a task's linked items", async () => {
    const task = makeItem({ title: "T" });
    const other = makeItem({ title: "Other task" });
    const w = world([task, other]);
    await linkItems(w.notes, task.id, other.id);
    expect(await linkedNotes(w.notes, task.id)).toEqual([]);
  });

  it("refuses an item that is gone", async () => {
    const w = world();
    expect((await createLinkedNote(w.notes, w.items, "00000000-0000-4000-8000-0000000000ff")).ok).toBe(false);
    expect(w.store.items).toHaveLength(0);
  });
});

describe("searchItems", () => {
  it("finds every type, with a link to where each opens", async () => {
    const note = makeItem({ type: "note", title: "Ferry times" });
    const task = makeItem({ title: "Book the ferry" });
    const w = world([note, task]);
    const rows = await searchItems(w.notes, " ferry ");
    expect(rows.map((r) => r.href).sort()).toEqual([`/notes/${note.id}`, `/today?item=${task.id}`].sort());
  });

  it("does not search for nothing", async () => {
    const w = world([makeItem({ title: "x" })]);
    expect(await searchItems(w.notes, "   ")).toEqual([]);
    expect(await searchItems(w.notes, "x".repeat(201))).toEqual([]);
  });
});
