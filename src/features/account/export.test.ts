import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { collectExport, exportFilename, readAll, serializeExport, type ExportTable, type PageReader } from "./export";

const USER = "6f1c2a9e-4b7d-4c8e-9a1f-2d3e4f5a6b7c";
const AREA = "0b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const ITEM = "1b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const NOTE = "2b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const TAG = "3b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const LINK = "4b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const T = "2026-10-06T08:00:00.123456+00:00";
const ISO = "2026-10-06T08:00:00.123Z";

const rows = {
  areas: [{ id: AREA, name: "Work", position: 1, created_at: T, updated_at: T, deleted_at: "2026-10-07T01:00:00+08:00" }],
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
  tags: [{ id: TAG, name: "deep", created_at: T, updated_at: T }],
  item_tags: [{ item_id: ITEM, tag_id: TAG, created_at: T, updated_at: T }],
};

describe("serializeExport", () => {
  it("writes every table in camelCase with ISO timestamps", () => {
    const doc = serializeExport({ userId: USER, exportedAt: new Date("2026-10-06T12:00:00Z"), rows });
    expect(doc).toEqual({
      version: 1,
      exportedAt: "2026-10-06T12:00:00.000Z",
      user: { id: USER },
      areas: [{ id: AREA, name: "Work", position: 1, createdAt: ISO, updatedAt: ISO, deletedAt: "2026-10-06T17:00:00.000Z" }],
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
      tags: [{ id: TAG, name: "deep", createdAt: ISO, updatedAt: ISO }],
      itemTags: [{ itemId: ITEM, tagId: TAG, createdAt: ISO, updatedAt: ISO }],
    });
  });

  it("survives a JSON round trip unchanged", () => {
    const doc = serializeExport({ userId: USER, exportedAt: new Date(), rows });
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it("refuses a row that is missing a column rather than exporting it partly", () => {
    const broken = { ...rows, tags: [{ id: TAG, created_at: T, updated_at: T }] };
    expect(() => serializeExport({ userId: USER, exportedAt: new Date(), rows: broken })).toThrow();
  });
});

/** A paged source over `n` rows per table that, like a capped server, returns at most `cap` rows per call. */
function pagedSource(n: number, cap = Infinity) {
  const calls: [ExportTable, number, number][] = [];
  const read: PageReader = async (table, from, to) => {
    calls.push([table, from, to]);
    const end = Math.min(to + 1, n, from + cap);
    return Array.from({ length: Math.max(0, end - from) }, (_, i) => ({ table, n: from + i }));
  };
  return { read, calls };
}

describe("readAll", () => {
  it("reads in pages of 1000 until a page comes back empty", async () => {
    const { read, calls } = pagedSource(2500);
    const all = await readAll(read, "items");
    expect(all).toHaveLength(2500);
    expect(all.map((r) => (r as { n: number }).n)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(calls).toEqual([
      ["items", 0, 999],
      ["items", 1000, 1999],
      ["items", 2000, 2999],
      ["items", 2500, 3499],
    ]);
  });

  it("keeps going when the server returns fewer rows than asked for", async () => {
    const { read } = pagedSource(2500, 300);
    expect(await readAll(read, "items")).toHaveLength(2500);
  });

  it("reads exactly a full page and stops", async () => {
    const { read } = pagedSource(1000);
    expect(await readAll(read, "tags")).toHaveLength(1000);
  });
});

describe("collectExport", () => {
  it("reads every table and serializes what it read", async () => {
    const tables: ExportTable[] = [];
    const read: PageReader = async (table, from) => {
      if (from === 0) tables.push(table);
      return from === 0 ? rows[table] : [];
    };
    const doc = await collectExport(read, { userId: USER, exportedAt: new Date("2026-10-06T12:00:00Z") });
    expect(tables.sort()).toEqual(["areas", "item_tags", "items", "links", "tags"]);
    expect([doc.areas, doc.items, doc.links, doc.tags, doc.itemTags].map((t) => t.length)).toEqual([1, 2, 1, 1, 1]);
  });
});

describe("exportFilename", () => {
  it("names the file by the local date", () => {
    expect(exportFilename("2026-10-06" as LocalDate)).toBe("axiis-export-2026-10-06.json");
  });
});
