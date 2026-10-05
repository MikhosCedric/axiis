import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type Tx } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;

// The same predicate SupabaseNotesRepo.search sends through PostgREST:
// textSearch("search", q, { type: "websearch", config: "simple" }) plus deleted_at is null.
async function search(tx: Tx, q: string): Promise<string[]> {
  const { rows } = await tx.query<{ title: string }>(
    "select title from items where search @@ websearch_to_tsquery('simple', $1) and deleted_at is null order by title",
    [q],
  );
  return rows.map((r) => r.title);
}

beforeAll(async () => {
  db = await createTestDb();
  alice = await db.createUser();
  bob = await db.createUser();
  await db.asUser(alice, async (tx) => {
    await tx.query("insert into items (type, title) values ('task', 'Renew passport')");
    await tx.query("insert into items (type, title, body_text) values ('note', 'Garden', 'Plant tulips before the frost')");
    await tx.query("insert into items (type, title, body_text, deleted_at) values ('note', 'Old garden plan', 'tulips by the wall', now())");
  });
  await db.asUser(bob, async (tx) => {
    await tx.query("insert into items (type, title, body_text) values ('note', 'Bob passport', 'tulips and a passport photo')");
  });
});

describe("item search", () => {
  it("matches on the title", async () => {
    expect(await db.asUser(alice, (tx) => search(tx, "passport"))).toEqual(["Renew passport"]);
  });

  it("matches on the body text", async () => {
    expect(await db.asUser(alice, (tx) => search(tx, "frost"))).toEqual(["Garden"]);
  });

  it("reads websearch syntax: quoted phrases and excluded words", async () => {
    expect(await db.asUser(alice, (tx) => search(tx, '"plant tulips"'))).toEqual(["Garden"]);
    expect(await db.asUser(alice, (tx) => search(tx, "tulips -frost"))).toEqual([]);
  });

  it("never returns another user's rows", async () => {
    expect(await db.asUser(bob, (tx) => search(tx, "passport"))).toEqual(["Bob passport"]);
    expect(await db.asUser(alice, (tx) => search(tx, "photo"))).toEqual([]);
  });

  it("leaves out soft-deleted items", async () => {
    expect(await db.asUser(alice, (tx) => search(tx, "tulips"))).toEqual(["Garden"]);
  });

  it("follows edits to the title and body", async () => {
    const titles = await db.asUser(alice, async (tx) => {
      await tx.query("update items set title = 'Renew driving licence' where title = 'Renew passport'");
      await tx.query("update items set body_text = 'Bulbs in October' where title = 'Garden'");
      const result = [await search(tx, "licence"), await search(tx, "passport"), await search(tx, "frost"), await search(tx, "bulbs")];
      await tx.rollback();
      return result;
    });
    expect(titles).toEqual([["Renew driving licence"], [], [], ["Garden"]]);
  });

  it("keeps a short excerpt of the body", async () => {
    const excerpt = await db.asUser(alice, async (tx) => {
      await tx.query("update items set body_text = repeat('a', 1000) where title = 'Garden'");
      const { rows } = await tx.query<{ n: number }>("select char_length(excerpt) as n from items where title = 'Garden'");
      await tx.rollback();
      return rows[0].n;
    });
    expect(excerpt).toBe(280);
  });

  it("refuses a body text too large to index", async () => {
    await expect(
      db.asUser(alice, (tx) => tx.query("update items set body_text = repeat('a', 300000) where title = 'Garden'")),
    ).rejects.toThrow(/items_body_text_size/);
  });

  it("has a GIN index on the search column", async () => {
    const { rows } = await db.admin.query<{ def: string }>(
      "select indexdef as def from pg_indexes where tablename = 'items' and indexname = 'items_search'",
    );
    expect(rows[0]?.def).toMatch(/USING gin \(search\)/);
  });
});
