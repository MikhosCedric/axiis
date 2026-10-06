import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AreaId, ItemId, ItemType } from "@/domain/item";
import { ITEM_COLUMNS, itemFromRow } from "@/lib/items/mappers";
import { LINK_COLUMNS, NOTE_COLUMNS, NOTE_SUMMARY_COLUMNS, linkFromRow, noteFromRow, noteSummaryFromRow, searchHitFromRow } from "./mappers";
import { SEARCH_LIMIT, type LinkId, type LinkedItem, type Note, type NoteContent, type NoteSummary, type NotesRepo, type SearchHit } from "./repo";

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

export class NotesRepoError extends Error {
  override name = "NotesRepoError";
}

function unwrap<T>(operation: string, { data, error }: QueryResult, parse: (raw: unknown) => T): T {
  if (error) throw new NotesRepoError(`notes.${operation} failed: ${error.message}`, { cause: error });
  return parse(data);
}

const rows = (raw: unknown) => z.array(z.unknown()).parse(raw);

/** Row Level Security scopes every query to the client's signed-in user, and `user_id` defaults to `auth.uid()` on insert. */
export class SupabaseNotesRepo implements NotesRepo {
  constructor(private readonly db: SupabaseClient) {}

  private notes(columns: string) {
    return this.db.from("items").select(columns).eq("type", "note").is("deleted_at", null);
  }

  async listNotes(): Promise<NoteSummary[]> {
    const result = await this.notes(NOTE_SUMMARY_COLUMNS).order("updated_at", { ascending: false });
    return unwrap("listNotes", result, (raw) => rows(raw).map(noteSummaryFromRow));
  }

  async getNote(id: ItemId): Promise<Note | null> {
    const result = await this.notes(NOTE_COLUMNS).eq("id", id).maybeSingle();
    return unwrap("getNote", result, (raw) => (raw === null ? null : noteFromRow(raw)));
  }

  async createNote(input: { title: string; areaId: AreaId | null }): Promise<Note> {
    const result = await this.db
      .from("items")
      .insert({ type: "note", title: input.title, area_id: input.areaId })
      .select(NOTE_COLUMNS)
      .single();
    return unwrap("createNote", result, noteFromRow);
  }

  async saveNote(id: ItemId, content: NoteContent): Promise<Note> {
    const result = await this.db
      .from("items")
      .update({ title: content.title, body: content.body, body_text: content.bodyText })
      .eq("id", id)
      .eq("type", "note")
      .is("deleted_at", null)
      .select(NOTE_COLUMNS)
      .single();
    return unwrap("saveNote", result, noteFromRow);
  }

  async search(query: string, options: { type?: ItemType } = {}): Promise<SearchHit[]> {
    let request = this.db
      .from("items")
      .select(`${ITEM_COLUMNS},body_text`)
      .is("deleted_at", null)
      .textSearch("search", query, { type: "websearch", config: "simple" });
    if (options.type) request = request.eq("type", options.type);
    const result = await request.order("updated_at", { ascending: false }).limit(SEARCH_LIMIT);
    return unwrap("search", result, (raw) => rows(raw).map((r) => searchHitFromRow(r, query)));
  }

  async linksFor(itemId: ItemId): Promise<LinkedItem[]> {
    const links = unwrap(
      "linksFor",
      await this.db.from("links").select(LINK_COLUMNS).or(`from_id.eq.${itemId},to_id.eq.${itemId}`).order("created_at"),
      (raw) => rows(raw).map(linkFromRow),
    );
    const otherIds = links.map((l) => (l.fromId === itemId ? l.toId : l.fromId));
    if (otherIds.length === 0) return [];
    const items = unwrap(
      "linksFor",
      await this.db.from("items").select(ITEM_COLUMNS).in("id", otherIds).is("deleted_at", null),
      (raw) => new Map(rows(raw).map(itemFromRow).map((i) => [i.id, i])),
    );
    return links.flatMap((l) => {
      const outgoing = l.fromId === itemId;
      const item = items.get(outgoing ? l.toId : l.fromId);
      return item ? [{ linkId: l.id, direction: outgoing ? "outgoing" : "incoming", item } as const] : [];
    });
  }

  async link(fromId: ItemId, toId: ItemId): Promise<void> {
    const result = await this.db
      .from("links")
      .upsert({ from_id: fromId, to_id: toId }, { onConflict: "from_id,to_id,kind", ignoreDuplicates: true });
    unwrap("link", result, () => undefined);
  }

  async unlink(linkId: LinkId): Promise<void> {
    unwrap("unlink", await this.db.from("links").delete().eq("id", linkId), () => undefined);
  }
}
