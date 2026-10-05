import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";
import { countOwned, seedWorld, TABLES, type Table, type World } from "./fixtures";

let db: TestDb;
let a: World;
let b: World;

beforeAll(async () => {
  db = await createTestDb();
  a = await seedWorld(db, await db.createUser());
  b = await seedWorld(db, await db.createUser());
});

// Each forged row is otherwise valid for its victim: only RLS stands in the way.
const forgeInsert: Record<Table, (victim: World) => [string, unknown[]]> = {
  areas: (v) => ["insert into areas (user_id, name) values ($1, 'x')", [v.userId]],
  items: (v) => ["insert into items (user_id, type) values ($1, 'task')", [v.userId]],
  links: (v) => ["insert into links (user_id, from_id, to_id) values ($1, $2, $3)", [v.userId, v.itemId, v.otherItemId]],
  tags: (v) => ["insert into tags (user_id, name) values ($1, 'forged')", [v.userId]],
  item_tags: (v) => ["insert into item_tags (user_id, item_id, tag_id) values ($1, $2, $3)", [v.userId, v.otherItemId, v.tagId]],
};

describe.each(TABLES)("RLS on %s", (table) => {
  it("lets a user see their own rows and none of another user's", async () => {
    const visible = await db.asUser(a.userId, async (tx) => {
      const { rows } = await tx.query<{ user_id: string }>(`select user_id from ${table}`);
      return rows.map((r) => r.user_id);
    });
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((id) => id === a.userId)).toBe(true);
    expect(await countOwned(db, table, b.userId)).toBeGreaterThan(0);
  });

  it("rejects inserting a row owned by another user", async () => {
    const [sql, params] = forgeInsert[table](b);
    await expect(db.asUser(a.userId, (tx) => tx.query(sql, params))).rejects.toThrow(/row-level security/);
  });

  // These statements filter on no column: a filtered one also passes through the
  // select policy, which would hide a broken update or delete policy.
  it("updates only the user's own rows", async () => {
    const own = await countOwned(db, table, a.userId);
    const result = await db.asUser(a.userId, (tx) => tx.query(`update ${table} set updated_at = now() where true`));
    expect(own).toBeGreaterThan(0);
    expect(result.affectedRows).toBe(own);
  });

  it("rejects handing an own row to another user", async () => {
    await expect(
      db.asUser(a.userId, (tx) => tx.query(`update ${table} set user_id = $1 where true`, [b.userId])),
    ).rejects.toThrow(/row-level security/);
  });

  it("deletes only the user's own rows", async () => {
    const own = await countOwned(db, table, a.userId);
    const affected = await db.asUser(a.userId, async (tx) => {
      const result = await tx.query(`delete from ${table} where true`);
      await tx.rollback();
      return result.affectedRows;
    });
    expect(own).toBeGreaterThan(0);
    expect(affected).toBe(own);
  });
});

describe.each(TABLES)("anon on %s", (table) => {
  it.each([
    ["select", `select * from ${table}`],
    ["insert", `insert into ${table} default values`],
    ["update", `update ${table} set updated_at = now()`],
    ["delete", `delete from ${table}`],
  ])("is denied %s", async (_op, sql) => {
    await expect(db.asAnon((tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
  });
});
