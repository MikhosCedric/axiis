import type { Area, AreaId, Item, ItemId } from "@/domain/item";
import { deleteItem, setItemArea } from "@/features/detail/commands";
import { bodyText, type DocNode } from "@/features/notes/doc";
import { createNote, linkItems, saveNote, searchItems, unlinkItems } from "@/features/notes/commands";
import type { NotesActions } from "@/features/notes/model";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { fakeNotesRepo, type NotesStore } from "@/lib/notes/fake";
import type { LinkId } from "@/lib/notes/repo";

export const BASE = "/dev/notes";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;
const areaId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}` as AreaId;

export const AREAS: Area[] = [
  { id: areaId(1), name: "Work", position: 0 },
  { id: areaId(2), name: "Home", position: 1 },
  { id: areaId(3), name: "Health", position: 2 },
];

const t = (text: string, marks?: DocNode["marks"]): DocNode => ({ type: "text", text, ...(marks && { marks }) });
const p = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const li = (text: string): DocNode => ({ type: "listItem", content: [p(t(text))] });

const gardenBody: DocNode = {
  type: "doc",
  content: [
    p(t("The bed by the back wall gets sun until about two. Tulips there, herbs nearer the door.")),
    { type: "heading", attrs: { level: 2 }, content: [t("Before the frost")] },
    { type: "bulletList", content: [li("Lift the dahlias"), li("Mulch the roses"), li("Plant the bulbs")] },
    { type: "heading", attrs: { level: 3 }, content: [t("Where to buy")] },
    p(t("The nursery on "), t("Rua das Flores", [{ type: "bold" }]), t(" has good bulbs. "), t("Their list", [{ type: "link", attrs: { href: "https://example.com/bulbs" } }]), t(" is online.")),
    { type: "blockquote", content: [p(t("Plant bulbs twice as deep as they are tall."))] },
    { type: "codeBlock", content: [t("water: every 3 days")] },
  ],
};

const tripBody: DocNode = {
  type: "doc",
  content: [
    p(t("Ferry to Cacilhas runs every twenty minutes from Cais do Sodré.")),
    { type: "orderedList", content: [li("Day one: Alfama"), li("Day two: Belém"), li("Day three: Sintra")] },
  ],
};

function fixtures(): Item[] {
  return [
    makeItem({ id: id(1), title: "Plan the Lisbon trip", areaId: areaId(2) }),
    makeItem({ id: id(2), title: "Buy tulip bulbs", areaId: areaId(2), status: "done" }),
    makeItem({ id: id(3), type: "checklist", title: "Packing" }),
    makeItem({ id: id(20), type: "note", title: "Garden through the winter", body: gardenBody, areaId: areaId(2), updatedAt: new Date("2026-10-06T09:20:00Z") }),
    makeItem({ id: id(21), type: "note", title: "Lisbon ideas", body: tripBody, areaId: areaId(2), updatedAt: new Date("2026-10-02T18:00:00Z") }),
    makeItem({ id: id(22), type: "note", title: "", body: null, updatedAt: new Date("2025-12-30T10:00:00Z") }),
    makeItem({
      id: id(23),
      type: "note",
      title: "A note with a very long title that keeps going well past where a phone would wrap it, to check nothing scrolls sideways",
      body: { type: "doc", content: [p(t("Short body."))] },
      areaId: areaId(1),
      updatedAt: new Date("2026-09-12T08:00:00Z"),
    }),
  ];
}

function createStore() {
  const items = fixtures();
  const notesStore: NotesStore = { items, bodyText: new Map(), links: [] };
  for (const i of items) if (i.type === "note") notesStore.bodyText.set(i.id, bodyText(i.body as DocNode | null));
  notesStore.links.push(
    { id: "10000000-0000-4000-8000-000000000001" as LinkId, fromId: id(20), toId: id(2) },
    { id: "10000000-0000-4000-8000-000000000002" as LinkId, fromId: id(21), toId: id(20) },
    { id: "10000000-0000-4000-8000-000000000003" as LinkId, fromId: id(21), toId: id(1) },
  );
  const items_ = fakeRepo(items, AREAS).repo;
  items_.softDelete = async (gone) => {
    const at = items.findIndex((i) => i.id === gone);
    if (at >= 0) items.splice(at, 1);
  };
  return { notes: fakeNotesRepo(notesStore), items: items_, notesStore };
}

/** One store per browser tab, so client navigation between harness pages keeps edits. */
export const store = createStore();
export const settings = { failing: false };

const pause = () => new Promise((resolve) => setTimeout(resolve, 450));
const FAILED = { ok: false as const, error: "That did not save. Try again." };

/** Harness hrefs: notes open in the harness editor, everything else in the detail harness. */
export const harnessHref = (row: { id: string; type: string }) =>
  row.type === "note" ? `${BASE}/${row.id}` : `/dev/detail?item=${row.id}`;

/** A write that waits a moment, like a network round trip, and fails on demand. */
function slow<A extends unknown[], R>(write: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | typeof FAILED> => {
    await pause();
    return settings.failing ? FAILED : write(...args);
  };
}

export const actions: NotesActions = {
  create: slow(() => createNote(store.notes)),
  save: slow((noteId: string, c: { title: string; body: unknown }) => saveNote(store.notes, noteId, c.title, c.body)),
  setArea: slow((noteId: string, a: string | null) => setItemArea(store.items, noteId, a, "UTC")),
  remove: slow((noteId: string) => deleteItem(store.items, noteId, "UTC")),
  search: async (q) => (await searchItems(store.notes, store.items, q)).map((r) => ({ ...r, href: harnessHref(r) })),
  link: slow((a: string, b: string) => linkItems(store.notes, a, b)),
  unlink: slow((l: string) => unlinkItems(store.notes, l)),
};
