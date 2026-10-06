import type { AreaId, Item, ItemId, ItemType } from "@/domain/item";

export type LinkId = string & { readonly __brand: "LinkId" };

/** A note as the editor needs it. `body` is Tiptap JSON; `bodyText` its plain text, which search reads. */
export type Note = {
  id: ItemId;
  title: string;
  body: unknown | null;
  bodyText: string;
  areaId: AreaId | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A note in a list: no body, only the start of its text. */
export type NoteSummary = Omit<Note, "body" | "bodyText"> & { excerpt: string };

/**
 * One end of a link, seen from the item asked about. `outgoing` is a link this
 * item made; `incoming` is a backlink, made from the other item.
 */
export type LinkedItem = { linkId: LinkId; direction: "outgoing" | "incoming"; item: Item };

export type SearchHit = { item: Item; snippet: string };

export type NoteContent = { title: string; body: unknown; bodyText: string };

/**
 * Persistence for notes and links. Every read leaves out soft-deleted items,
 * including items at the far end of a link.
 */
export interface NotesRepo {
  /** Live notes, most recently edited first. */
  listNotes(): Promise<NoteSummary[]>;
  getNote(id: ItemId): Promise<Note | null>;
  createNote(input: { title: string; areaId: AreaId | null }): Promise<Note>;
  /** Writes title and body of a live note. Throws if there is no such note. */
  saveNote(id: ItemId, content: NoteContent): Promise<Note>;
  /** Full-text search over items of every type (or one type), newest edit first, at most 30. */
  search(query: string, options?: { type?: ItemType }): Promise<SearchHit[]>;
  linksFor(itemId: ItemId): Promise<LinkedItem[]>;
  /** Creates a reference link from one item to another. Linking twice leaves one link. */
  link(fromId: ItemId, toId: ItemId): Promise<void>;
  unlink(linkId: LinkId): Promise<void>;
}

export const SEARCH_LIMIT = 30;
