import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";
import { countOwned, seedWorld, TABLES } from "./fixtures";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

describe("new user", () => {
  it("gets exactly the three default areas, owned by them, in order", async () => {
    const userId = await db.createUser();
    const areas = await db.asUser(userId, async (tx) => {
      const { rows } = await tx.query<{ name: string; user_id: string }>("select name, user_id from areas order by position");
      return rows;
    });
    expect(areas).toEqual(["Work", "Home", "Health"].map((name) => ({ name, user_id: userId })));
  });
});

describe.each(TABLES)("updated_at on %s", (table) => {
  it("advances on update and leaves created_at alone", async () => {
    const userId = await db.createUser();
    await seedWorld(db, userId);
    const past = "2000-01-01T00:00:00Z";
    await db.seed(`update ${table} set created_at = $1, updated_at = $1 where user_id = $2`, [past, userId]);

    await db.asUser(userId, (tx) => tx.query(`update ${table} set user_id = user_id`));

    const { rows } = await db.admin.query<{ created_at: Date; updated_at: Date }>(
      `select created_at, updated_at from ${table} where user_id = $1`,
      [userId],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.created_at.toISOString()).toBe(new Date(past).toISOString());
      expect(row.updated_at.getTime()).toBeGreaterThan(Date.now() - 60_000);
    }
  });
});

describe("deleting an auth user", () => {
  it("removes every row they own and nothing of anyone else's", async () => {
    const gone = await db.createUser();
    const kept = await db.createUser();
    const goneWorld = await seedWorld(db, gone);
    await seedWorld(db, kept);
    await db.asUser(gone, (tx) =>
      tx.query("insert into items (type, parent_id, area_id) values ('task', $1, $2)", [goneWorld.itemId, goneWorld.areaId]),
    );

    const keptBefore = await Promise.all(TABLES.map((t) => countOwned(db, t, kept)));
    await db.admin.query("delete from auth.users where id = $1", [gone]);

    expect(await Promise.all(TABLES.map((t) => countOwned(db, t, gone)))).toEqual(TABLES.map(() => 0));
    expect(await Promise.all(TABLES.map((t) => countOwned(db, t, kept)))).toEqual(keptBefore);
  });
});
