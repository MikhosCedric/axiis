import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { exportChunks, exportFilename, pages, type AxiisExport, type ExportTable, type ExportUser, type PageReader } from "./export";

const USER = "6f1c2a9e-4b7d-4c8e-9a1f-2d3e4f5a6b7c";
const AREA = "0b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const ITEM = "1b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const NOTE = "2b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const TAG = "3b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const LINK = "4b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const T = "2026-10-06T08:00:00.123456+00:00";
const ISO = "2026-10-06T08:00:00.123Z";
const OWNER: ExportUser = { id: USER, email: "ana@example.com", createdAt: "2026-01-02T03:04:05.000Z" };

const rows: Record<ExportTable, unknown[]> = {
  areas: [{ id: AREA, name: "Work", position: 1, color: "moss", created_at: T, updated_at: T, deleted_at: "2026-10-07T01:00:00+08:00" }],
  items: [
    {
      id: ITEM,
      type: "task",
      title: "Write the brief",
      body: null,
      status: "done",
      area_id: AREA,
      parent_id: null,
      position: 1.5,
      start_at: "2026-10-06T09:00:00+00:00",
      end_at: "2026-10-06T09:30:00+00:00",
      scheduled_on: null,
      due_on: "2026-10-09",
      rrule: "FREQ=WEEKLY",
      series_id: null,
      original_on: null,
      completed_at: T,
      created_at: T,
      updated_at: T,
      deleted_at: null,
    },
    {
      id: NOTE,
      type: "note",
      title: "Ideas",
      body: { type: "doc", content: [] },
      status: "open",
      area_id: null,
      parent_id: null,
      position: 0,
      start_at: null,
      end_at: null,
      scheduled_on: null,
      due_on: null,
      rrule: null,
      series_id: ITEM,
      original_on: "2026-10-13",
      completed_at: null,
      created_at: T,
      updated_at: T,
      deleted_at: null,
    },
  ],
  links: [{ id: LINK, from_id: NOTE, to_id: ITEM, kind: "reference", created_at: T, updated_at: T }],
  tags: [{ id: TAG, name: "deep", color: "indigo", created_at: T, updated_at: T }],
  item_tags: [{ item_id: ITEM, tag_id: TAG, created_at: T, updated_at: T }],
};

/** A paged source over fixed rows that, like a capped server, returns at most `cap` rows per call. */
function source(tables: Record<ExportTable, unknown[]>, cap = Infinity) {
  const calls: [ExportTable, number, number][] = [];
  const read: PageReader = async (table, from, to) => {
    calls.push([table, from, to]);
    return tables[table].slice(from, Math.min(to + 1, from + cap));
  };
  return { read, calls };
}

async function text(chunks: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of chunks) out += chunk;
  return out;
}

const exportedAt = new Date("2026-10-06T12:00:00Z");

describe("exportChunks", () => {
  it("writes every table in camelCase with ISO timestamps and names the account", async () => {
    const doc: AxiisExport = JSON.parse(await text(exportChunks(source(rows).read, { user: OWNER, exportedAt })));
    expect(doc).toEqual({
      version: 1,
      exportedAt: "2026-10-06T12:00:00.000Z",
      user: OWNER,
      areas: [{ id: AREA, name: "Work", position: 1, color: "moss", createdAt: ISO, updatedAt: ISO, deletedAt: "2026-10-06T17:00:00.000Z" }],
      items: [
        {
          id: ITEM,
          type: "task",
          title: "Write the brief",
          body: null,
          status: "done",
          areaId: AREA,
          parentId: null,
          position: 1.5,
          startAt: "2026-10-06T09:00:00.000Z",
          endAt: "2026-10-06T09:30:00.000Z",
          scheduledOn: null,
          dueOn: "2026-10-09",
          rrule: "FREQ=WEEKLY",
          seriesId: null,
          originalOn: null,
          completedAt: ISO,
          createdAt: ISO,
          updatedAt: ISO,
          deletedAt: null,
        },
        expect.objectContaining({ id: NOTE, body: { type: "doc", content: [] }, startAt: null, seriesId: ITEM, originalOn: "2026-10-13" }),
      ],
      links: [{ id: LINK, fromId: NOTE, toId: ITEM, kind: "reference", createdAt: ISO, updatedAt: ISO }],
      tags: [{ id: TAG, name: "deep", color: "indigo", createdAt: ISO, updatedAt: ISO }],
      itemTags: [{ itemId: ITEM, tagId: TAG, createdAt: ISO, updatedAt: ISO }],
    });
  });

  it("writes valid JSON for an account with nothing in it", async () => {
    const empty = { areas: [], items: [], links: [], tags: [], item_tags: [] };
    const user = { id: USER, email: null, createdAt: null };
    expect(JSON.parse(await text(exportChunks(source(empty).read, { user, exportedAt })))).toEqual({
      version: 1,
      exportedAt: "2026-10-06T12:00:00.000Z",
      user,
      areas: [],
      items: [],
      links: [],
      tags: [],
      itemTags: [],
    });
  });

  it("sends one chunk per page, so the whole account is never one string", async () => {
    const many = { ...rows, tags: Array.from({ length: 2500 }, (_, i) => ({ id: `t${i}`, name: `n${i}`, color: null, created_at: T, updated_at: T })) };
    const chunks: string[] = [];
    for await (const chunk of exportChunks(source(many).read, { user: OWNER, exportedAt }, 1000)) chunks.push(chunk);
    expect(chunks.length).toBeGreaterThanOrEqual(7);
    const doc: AxiisExport = JSON.parse(chunks.join(""));
    expect(doc.tags.map((t) => t.name)).toEqual(Array.from({ length: 2500 }, (_, i) => `n${i}`));
  });

  it("reads before it sends anything, so a failed first read never starts a download", async () => {
    const read: PageReader = async () => {
      throw new Error("down");
    };
    await expect(exportChunks(read, { user: OWNER, exportedAt }).next()).rejects.toThrow("down");
  });

  it("stops rather than exporting a row that is missing a column", async () => {
    const broken = { ...rows, tags: [{ id: TAG, created_at: T, updated_at: T }] };
    await expect(text(exportChunks(source(broken).read, { user: OWNER, exportedAt }))).rejects.toThrow();
  });
});

describe("pages", () => {
  const numbered = (n: number) => ({ ...rows, items: Array.from({ length: n }, (_, i) => i) });
  async function all(read: PageReader, table: ExportTable) {
    const out: unknown[] = [];
    for await (const page of pages(read, table)) out.push(...page);
    return out;
  }

  it("reads in pages of 1000 until a page comes back empty", async () => {
    const { read, calls } = source(numbered(2500));
    expect(await all(read, "items")).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(calls).toEqual([
      ["items", 0, 999],
      ["items", 1000, 1999],
      ["items", 2000, 2999],
      ["items", 2500, 3499],
    ]);
  });

  it("keeps going when the server returns fewer rows than asked for", async () => {
    const { read } = source(numbered(2500), 300);
    expect(await all(read, "items")).toHaveLength(2500);
  });

  it("reads exactly a full page and stops", async () => {
    const { read } = source(numbered(1000));
    expect(await all(read, "items")).toHaveLength(1000);
  });
});

describe("exportFilename", () => {
  it("names the file by the local date", () => {
    expect(exportFilename("2026-10-06" as LocalDate)).toBe("axiis-export-2026-10-06.json");
  });
});
