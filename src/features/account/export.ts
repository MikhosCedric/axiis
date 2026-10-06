import { z } from "zod";
import type { LocalDate } from "@/domain/item";

export const EXPORT_PAGE_SIZE = 1000;

// Enums are read as plain strings: an export must stay faithful even if a value
// is newer than this code, rather than fail and leave the user with nothing.
const timestamp = z.iso.datetime({ offset: true }).transform((s) => new Date(s).toISOString());
const optionalTimestamp = timestamp.nullable();

const areaRow = z
  .object({
    id: z.string(),
    name: z.string(),
    position: z.number(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: optionalTimestamp,
  })
  .transform((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));

const itemRow = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    body: z.unknown().transform((v) => v ?? null),
    status: z.string(),
    area_id: z.string().nullable(),
    parent_id: z.string().nullable(),
    position: z.number(),
    start_at: optionalTimestamp,
    end_at: optionalTimestamp,
    scheduled_on: z.string().nullable(),
    due_on: z.string().nullable(),
    rrule: z.string().nullable(),
    completed_at: optionalTimestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: optionalTimestamp,
  })
  .transform((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    status: r.status,
    areaId: r.area_id,
    parentId: r.parent_id,
    position: r.position,
    startAt: r.start_at,
    endAt: r.end_at,
    scheduledOn: r.scheduled_on,
    dueOn: r.due_on,
    rrule: r.rrule,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));

const linkRow = z
  .object({ id: z.string(), from_id: z.string(), to_id: z.string(), kind: z.string(), created_at: timestamp, updated_at: timestamp })
  .transform((r) => ({ id: r.id, fromId: r.from_id, toId: r.to_id, kind: r.kind, createdAt: r.created_at, updatedAt: r.updated_at }));

const tagRow = z
  .object({ id: z.string(), name: z.string(), created_at: timestamp, updated_at: timestamp })
  .transform((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }));

const itemTagRow = z
  .object({ item_id: z.string(), tag_id: z.string(), created_at: timestamp, updated_at: timestamp })
  .transform((r) => ({ itemId: r.item_id, tagId: r.tag_id, createdAt: r.created_at, updatedAt: r.updated_at }));

/**
 * Every table the user owns, the columns to read, and a total order so paging
 * neither skips nor repeats a row. Soft-deleted rows are included: they are still the user's data.
 */
export const EXPORT_TABLES = {
  areas: { columns: "id,name,position,created_at,updated_at,deleted_at", orderBy: ["id"] },
  items: {
    columns:
      "id,type,title,body,status,area_id,parent_id,position,start_at,end_at,scheduled_on,due_on,rrule,completed_at,created_at,updated_at,deleted_at",
    orderBy: ["id"],
  },
  links: { columns: "id,from_id,to_id,kind,created_at,updated_at", orderBy: ["id"] },
  tags: { columns: "id,name,created_at,updated_at", orderBy: ["id"] },
  item_tags: { columns: "item_id,tag_id,created_at,updated_at", orderBy: ["item_id", "tag_id"] },
} as const;

export type ExportTable = keyof typeof EXPORT_TABLES;
export const EXPORT_TABLE_NAMES = Object.keys(EXPORT_TABLES) as ExportTable[];

/** Reads rows `[from, to]` inclusive, in the table's `orderBy` order. */
export type PageReader = (table: ExportTable, from: number, to: number) => Promise<unknown[]>;

export type AxiisExport = {
  version: 1;
  exportedAt: string;
  user: { id: string };
  areas: z.output<typeof areaRow>[];
  items: z.output<typeof itemRow>[];
  links: z.output<typeof linkRow>[];
  tags: z.output<typeof tagRow>[];
  itemTags: z.output<typeof itemTagRow>[];
};

/**
 * Reads a table to the end. Advances by the rows actually returned and stops
 * only on an empty page, so a server that caps pages below the requested size
 * still yields every row.
 */
export async function readAll(read: PageReader, table: ExportTable, pageSize = EXPORT_PAGE_SIZE): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (;;) {
    const page = await read(table, rows.length, rows.length + pageSize - 1);
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}

export async function collectExport(
  read: PageReader,
  { userId, exportedAt }: { userId: string; exportedAt: Date },
): Promise<AxiisExport> {
  const [areas, items, links, tags, itemTags] = await Promise.all(EXPORT_TABLE_NAMES.map((t) => readAll(read, t)));
  return serializeExport({ userId, exportedAt, rows: { areas, items, links, tags, item_tags: itemTags } });
}

/** Parses raw rows into the export document. Throws on a row that does not match its table. */
export function serializeExport({
  userId,
  exportedAt,
  rows,
}: {
  userId: string;
  exportedAt: Date;
  rows: Record<ExportTable, unknown[]>;
}): AxiisExport {
  return {
    version: 1,
    exportedAt: exportedAt.toISOString(),
    user: { id: userId },
    areas: rows.areas.map((r) => areaRow.parse(r)),
    items: rows.items.map((r) => itemRow.parse(r)),
    links: rows.links.map((r) => linkRow.parse(r)),
    tags: rows.tags.map((r) => tagRow.parse(r)),
    itemTags: rows.item_tags.map((r) => itemTagRow.parse(r)),
  };
}

export function exportFilename(date: LocalDate): string {
  return `axiis-export-${date}.json`;
}
