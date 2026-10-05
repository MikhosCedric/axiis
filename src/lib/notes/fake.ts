import type { Item, ItemId } from "@/domain/item";
import { SEARCH_LIMIT, type LinkId, type Note, type NotesRepo } from "./repo";
import { queryTerms, snippetFor } from "./snippet";

export type FakeLink = { id: LinkId; fromId: ItemId; toId: ItemId };

/**
 * State shared by the in-memory repos. `items` can be the same array an
 * ItemsRepo fake works on; an item missing from it counts as deleted.
 */
export type NotesStore = { items: Item[]; bodyText: Map<string, string>; links: FakeLink[] };

let seq = 0;
const uuid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

/** In-memory NotesRepo for tests and dev harnesses. Search matches every query word against title and body text. */
export function fakeNotesRepo(store: NotesStore, now: () => Date = () => new Date()): NotesRepo {
  const live = (id: ItemId) => store.items.find((i) => i.id === id) ?? null;
  const toNote = (i: Item): Note => ({
    id: i.id,
    title: i.title,
    body: i.body,
    bodyText: store.bodyText.get(i.id) ?? "",
    areaId: i.areaId,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  });
  const byEdit = (a: Item, b: Item) => b.updatedAt.getTime() - a.updatedAt.getTime();

  return {
    async listNotes() {
      return store.items
        .filter((i) => i.type === "note")
        .sort(byEdit)
        .map((i) => {
          const { body: _body, bodyText, ...rest } = toNote(i);
          return { ...rest, excerpt: bodyText.slice(0, 280) };
        });
    },
    async getNote(id) {
      const i = live(id);
      return i && i.type === "note" ? toNote(i) : null;
    },
    async createNote({ title, areaId }) {
      const at = now();
      const item: Item = {
        id: uuid("00000000") as ItemId,
        type: "note",
        title,
        body: null,
        status: "open",
        areaId,
        parentId: null,
        position: 0,
        schedule: { kind: "unscheduled" },
        dueOn: null,
        rrule: null,
        completedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      store.items.push(item);
      return toNote(item);
    },
    async saveNote(id, { title, body, bodyText }) {
      const i = live(id);
      if (!i || i.type !== "note") throw new Error(`no note ${id}`);
      Object.assign(i, { title, body, updatedAt: now() });
      store.bodyText.set(id, bodyText);
      return toNote(i);
    },
    async search(query, { type } = {}) {
      const terms = queryTerms(query);
      if (terms.length === 0) return [];
      return store.items
        .filter((i) => !type || i.type === type)
        .filter((i) => {
          const hay = `${i.title} ${store.bodyText.get(i.id) ?? ""}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
        .sort(byEdit)
        .slice(0, SEARCH_LIMIT)
        .map((item) => ({ item, snippet: snippetFor(store.bodyText.get(item.id) ?? "", query) }));
    },
    async linksFor(itemId) {
      return store.links.flatMap((l) => {
        if (l.fromId !== itemId && l.toId !== itemId) return [];
        const outgoing = l.fromId === itemId;
        const item = live(outgoing ? l.toId : l.fromId);
        return item ? [{ linkId: l.id, direction: outgoing ? "outgoing" : "incoming", item } as const] : [];
      });
    },
    async link(fromId, toId) {
      if (fromId === toId) throw new Error("an item cannot link to itself");
      if (!live(fromId) || !live(toId)) throw new Error("no such item");
      if (store.links.some((l) => l.fromId === fromId && l.toId === toId)) return;
      store.links.push({ id: uuid("10000000") as LinkId, fromId, toId });
    },
    async unlink(linkId) {
      store.links = store.links.filter((l) => l.id !== linkId);
    },
  };
}
