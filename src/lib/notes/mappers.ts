import { z } from "zod";
import { idSchema, type AreaId, type ItemId } from "@/domain/item";
import { itemFromRow } from "@/lib/items/mappers";
import type { LinkId, Note, NoteSummary, SearchHit } from "./repo";
import { snippetFor } from "./snippet";

export const NOTE_COLUMNS = "id,title,body,body_text,area_id,created_at,updated_at";
export const NOTE_SUMMARY_COLUMNS = "id,title,excerpt,area_id,created_at,updated_at";
export const LINK_COLUMNS = "id,from_id,to_id";

const timestamp = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const itemId = idSchema.transform((s) => s as ItemId);
const text = z
  .string()
  .nullable()
  .transform((s) => s ?? "");

const noteBase = {
  id: itemId,
  title: z.string(),
  area_id: idSchema.transform((s) => s as AreaId).nullable(),
  created_at: timestamp,
  updated_at: timestamp,
};

const noteRow = z.object({ ...noteBase, body: z.unknown().transform((v) => v ?? null), body_text: text });
const summaryRow = z.object({ ...noteBase, excerpt: text });
const linkRow = z.object({ id: idSchema.transform((s) => s as LinkId), from_id: itemId, to_id: itemId });
const bodyTextRow = z.object({ body_text: text });

export function noteFromRow(raw: unknown): Note {
  const r = noteRow.parse(raw);
  return { id: r.id, title: r.title, body: r.body, bodyText: r.body_text, areaId: r.area_id, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function noteSummaryFromRow(raw: unknown): NoteSummary {
  const r = summaryRow.parse(raw);
  return { id: r.id, title: r.title, excerpt: r.excerpt, areaId: r.area_id, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function linkFromRow(raw: unknown) {
  const r = linkRow.parse(raw);
  return { id: r.id, fromId: r.from_id, toId: r.to_id };
}

/** Parses an items row that also carries `body_text`, cutting a snippet around the query. */
export function searchHitFromRow(raw: unknown, query: string): SearchHit {
  return { item: itemFromRow(raw), snippet: snippetFor(bodyTextRow.parse(raw).body_text, query) };
}
