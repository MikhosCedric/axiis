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
    color: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: optionalTimestamp,
  })
  .transform((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    color: r.color,
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
    series_id: z.string().nullable(),
    original_on: z.string().nullable(),
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
    seriesId: r.series_id,
    originalOn: r.original_on,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));

const linkRow = z
  .object({ id: z.string(), from_id: z.string(), to_id: z.string(), kind: z.string(), created_at: timestamp, updated_at: timestamp })
  .transform((r) => ({ id: r.id, fromId: r.from_id, toId: r.to_id, kind: r.kind, createdAt: r.created_at, updatedAt: r.updated_at }));

const tagRow = z
  .object({ id: z.string(), name: z.string(), color: z.string().nullable(), created_at: timestamp, updated_at: timestamp })
  .transform((r) => ({ id: r.id, name: r.name, color: r.color, createdAt: r.created_at, updatedAt: r.updated_at }));

const itemTagRow = z
  .object({ item_id: z.string(), tag_id: z.string(), created_at: timestamp, updated_at: timestamp })
  .transform((r) => ({ itemId: r.item_id, tagId: r.tag_id, createdAt: r.created_at, updatedAt: r.updated_at }));

/**
 * Every table the user owns, the columns to read, and a total order so paging
 * neither skips nor repeats a row. Soft-deleted rows are included: they are still the user's data.
 */
export const EXPORT_TABLES = {
  areas: { columns: "id,name,position,color,created_at,updated_at,deleted_at", orderBy: ["id"] },
  items: {
    columns:
      "id,type,title,body,status,area_id,parent_id,position,start_at,end_at,scheduled_on,due_on,rrule,series_id,original_on,completed_at,created_at,updated_at,deleted_at",
    orderBy: ["id"],
  },
  links: { columns: "id,from_id,to_id,kind,created_at,updated_at", orderBy: ["id"] },
  tags: { columns: "id,name,color,created_at,updated_at", orderBy: ["id"] },
  item_tags: { columns: "item_id,tag_id,created_at,updated_at", orderBy: ["item_id", "tag_id"] },
} as const;

export type ExportTable = keyof typeof EXPORT_TABLES;
export const EXPORT_TABLE_NAMES = Object.keys(EXPORT_TABLES) as ExportTable[];

/** Reads rows `[from, to]` inclusive, in the table's `orderBy` order. */
export type PageReader = (table: ExportTable, from: number, to: number) => Promise<unknown[]>;

/** Who the export belongs to. Email and sign-up time are null when the session does not carry them. */
export type ExportUser = { id: string; email: string | null; createdAt: string | null };

export type AxiisExport = {
  version: 1;
  exportedAt: string;
  user: ExportUser;
  areas: z.output<typeof areaRow>[];
  items: z.output<typeof itemRow>[];
  links: z.output<typeof linkRow>[];
  tags: z.output<typeof tagRow>[];
  itemTags: z.output<typeof itemTagRow>[];
};

/** Each table's key in the document and its row parser, in document order. */
const SECTIONS: Record<ExportTable, { key: keyof AxiisExport; row: z.ZodType }> = {
  areas: { key: "areas", row: areaRow },
  items: { key: "items", row: itemRow },
  links: { key: "links", row: linkRow },
  tags: { key: "tags", row: tagRow },
  item_tags: { key: "itemTags", row: itemTagRow },
};

/**
 * Reads a table to the end, a page at a time. Advances by the rows actually
 * returned and stops only on an empty page, so a server that caps pages below
 * the requested size still yields every row.
 */
export async function* pages(read: PageReader, table: ExportTable, pageSize = EXPORT_PAGE_SIZE): AsyncGenerator<unknown[]> {
  for (let from = 0; ; ) {
    const page = await read(table, from, from + pageSize - 1);
    if (page.length === 0) return;
    from += page.length;
    yield page;
  }
}

/**
 * The export document as JSON text, one chunk per page read, so memory holds a
 * page rather than the account. Every row is parsed before it is written, and a
 * row that does not match its table throws, which leaves the text unfinished
 * and unparseable rather than partly exported. The first chunk carries the
 * first page, so a failure to read at all surfaces before anything is sent.
 */
export async function* exportChunks(
  read: PageReader,
  { user, exportedAt }: { user: ExportUser; exportedAt: Date },
  pageSize = EXPORT_PAGE_SIZE,
): AsyncGenerator<string> {
  let pending = `{"version":1,"exportedAt":${JSON.stringify(exportedAt.toISOString())},"user":${JSON.stringify(user)}`;
  for (const table of EXPORT_TABLE_NAMES) {
    const { key, row } = SECTIONS[table];
    pending += `,\n${JSON.stringify(key)}:[`;
    let separator = "\n";
    for await (const page of pages(read, table, pageSize)) {
      yield pending + separator + page.map((r) => JSON.stringify(row.parse(r))).join(",\n");
      pending = "";
      separator = ",\n";
    }
    pending += "]";
  }
  yield `${pending}}\n`;
}

export function exportFilename(date: LocalDate): string {
  return `axiis-export-${date}.json`;
}
