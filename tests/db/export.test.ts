import { beforeAll, describe, expect, it } from "vitest";
import { EXPORT_TABLES, exportChunks, type AxiisExport, type ExportTable, type PageReader } from "@/features/account/export";
import { createTestDb, type TestDb } from "./harness";
import { seedWorld, type World } from "./fixtures";

let db: TestDb;
let a: World;
let b: World;

beforeAll(async () => {
  db = await createTestDb();
  a = await seedWorld(db, await db.createUser());
  b = await seedWorld(db, await db.createUser());
  await db.asUser(a.userId, async (tx) => {
    const series = await tx.query<{ id: string }>(
      "insert into items (type, title, scheduled_on, rrule) values ('task', 'Water the ferns', '2026-10-01', 'FREQ=DAILY') returning id",
    );
    const errands = await tx.query<{ id: string }>("insert into tags (name) values ('Errands') returning id");
    await tx.query("insert into item_tags (item_id, tag_id) values ($1, $2)", [series.rows[0].id, errands.rows[0].id]);
  });
});

/** Reads a page the way the export route does, as JSON rows the way PostgREST sends them, under the user's RLS. */
function readerFor(userId: string): PageReader {
  return (table: ExportTable, from: number, to: number) => {
    const { columns, orderBy } = EXPORT_TABLES[table];
    return db.asUser(userId, async (tx) => {
      const sql = `select to_jsonb(r) as row from (select ${columns} from ${table} order by ${orderBy.join(", ")} limit $1 offset $2) r`;
      return (await tx.query<{ row: unknown }>(sql, [to - from + 1, from])).rows.map((r) => r.row);
    });
  };
}

describe("export against the schema", () => {
  it("reads every column it asks for and carries the user's tags and what they are on, nobody else's", async () => {
    let text = "";
    const user = { id: a.userId, email: null, createdAt: null };
    for await (const chunk of exportChunks(readerFor(a.userId), { user, exportedAt: new Date() }, 1)) text += chunk;
    const doc: AxiisExport = JSON.parse(text);

    expect(doc.tags.map((t) => t.name).sort()).toEqual(["Errands", "tag"]);
    expect(doc.tags.map((t) => t.id)).not.toContain(b.tagId);
    const series = doc.items.find((i) => i.title === "Water the ferns")!;
    const errands = doc.tags.find((t) => t.name === "Errands")!;
    expect(doc.itemTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: a.itemId, tagId: a.tagId }),
        expect.objectContaining({ itemId: series.id, tagId: errands.id }),
      ]),
    );
    expect(doc.itemTags).toHaveLength(2);
    expect(series.rrule).toBe("FREQ=DAILY");
  });
});
