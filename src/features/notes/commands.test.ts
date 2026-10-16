import { describe, expect, it } from "vitest";
import type { AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { fakeNotesRepo, type NotesStore } from "@/lib/notes/fake";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import {
  createLinkedNote,
  createNote,
  linkedNotes,
  linkItems,
  listNoteRows,
  loadNote,
  parseQuery,
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
  const fake = fakeRepo(items, [home]);
  return { store, notes, items: fake.repo, tag: fake.tag };
}

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("parseQuery", () => {
  it("drops control characters, which no title holds and HTML cannot carry", () => {
    expect(parseQuery("\0")).toBeNull();
    expect(parseQuery(" \u0000\u001f\u007f ")).toBeNull();
    expect(parseQuery("bike\0 shop\u0007")).toBe("bike  shop");
    expect(parseQuery("  garden  ")).toBe("garden");
  });
});

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
    const rows = await listNoteRows(w.notes, w.items, null, NOW, TZ, "24");
    expect(rows).toEqual([
      { id: newer.id, title: "Untitled note", firstLine: "", areaName: null, areaColor: null, edited: "Edited today, 11:05" },
      { id: older.id, title: "Older", firstLine: "First line", areaName: "Home", areaColor: null, edited: "Edited 30 Sept" },
    ]);
  });

  it("filters to notes that match a search", async () => {
    const garden = makeItem({ type: "note", title: "Garden" });
    const w = world([garden, makeItem({ type: "note", title: "Trip" }), makeItem({ title: "Garden task" })]);
    const rows = await listNoteRows(w.notes, w.items, "garden", NOW, TZ, "24");
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
    const view = await loadNote(w.notes, w.items, note.id, NOW, TZ, "24");
    expect(view?.connected).toEqual([
      expect.objectContaining({ id: task.id, title: "Buy compost", done: true, backlink: false, href: `/today?item=${task.id}` }),
      expect.objectContaining({ id: other.id, title: "Bulbs", backlink: true, href: `/notes/${other.id}` }),
    ]);
    await unlinkItems(w.notes, view?.connected[1].linkId);
    expect((await loadNote(w.notes, w.items, note.id, NOW, TZ, "24"))?.connected.map((c) => c.id)).toEqual([task.id]);
  });

  it("hides links to deleted items", async () => {
    const note = makeItem({ type: "note" });
    const task = makeItem({ title: "T" });
    const w = world([note, task]);
    await linkItems(w.notes, note.id, task.id);
    w.store.items.splice(w.store.items.indexOf(task), 1);
    expect((await loadNote(w.notes, w.items, note.id, NOW, TZ, "24"))?.connected).toEqual([]);
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
    const rows = await searchItems(w.notes, w.items, " ferry ");
    expect(rows.map((r) => r.href).sort()).toEqual([`/notes/${note.id}`, `/today?item=${task.id}`].sort());
  });

  it("does not search for nothing", async () => {
    const w = world([makeItem({ title: "x" })]);
    expect(await searchItems(w.notes, w.items, "   ")).toEqual([]);
    expect(await searchItems(w.notes, w.items, "x".repeat(201))).toEqual([]);
  });

  describe("with #tags", () => {
    const at = (iso: string) => new Date(iso);
    const ferryTask = makeItem({ title: "Book the ferry", updatedAt: at("2026-10-01T00:00:00Z") });
    const ferryNote = makeItem({ type: "note", title: "Ferry times", updatedAt: at("2026-10-03T00:00:00Z") });
    const bulbs = makeItem({ title: "Buy bulbs", status: "done", updatedAt: at("2026-10-02T00:00:00Z") });
    const series = makeItem({
      title: "Water the ferns",
      schedule: { kind: "day", on: "2026-10-01" as LocalDate },
      recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
    });
    const override = makeItem({
      title: "Water the ferns by the ferry",
      schedule: { kind: "day", on: "2026-10-02" as LocalDate },
      recurrence: { kind: "override", seriesId: series.id, originalOn: "2026-10-02" as LocalDate },
    });
    function tagged() {
      const w = world([ferryTask, ferryNote, bulbs, series, override].map((i) => ({ ...i })));
      w.tag(ferryTask.id, "Trip");
      w.tag(bulbs.id, "trip", "garden");
      w.tag(series.id, "garden");
      return w;
    }
    const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

    it("keeps word matches to items carrying the tag, in any case", async () => {
      const w = tagged();
      expect(titles(await searchItems(w.notes, w.items, "ferry #TRIP"))).toEqual(["Book the ferry"]);
    });

    it("lists everything carrying the tags when there are no words, most recently edited first", async () => {
      const w = tagged();
      expect(titles(await searchItems(w.notes, w.items, "#trip"))).toEqual(["Buy bulbs", "Book the ferry"]);
      expect(titles(await searchItems(w.notes, w.items, "#trip #garden"))).toEqual(["Buy bulbs"]);
    });

    it("counts an override as wearing its series' tags", async () => {
      const w = tagged();
      expect(titles(await searchItems(w.notes, w.items, "ferry #garden"))).toEqual(["Water the ferns by the ferry"]);
    });

    it("finds nothing for a tag that does not exist, words or not", async () => {
      const w = tagged();
      expect(await searchItems(w.notes, w.items, "#nope")).toEqual([]);
      expect(await searchItems(w.notes, w.items, "ferry #trip #nope")).toEqual([]);
    });
  });
});
