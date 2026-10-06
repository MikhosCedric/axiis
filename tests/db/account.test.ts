import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";
import { countOwned, seedWorld, TABLES, type World } from "./fixtures";

let db: TestDb;
let a: World;
let b: World;

async function userExists(id: string): Promise<boolean> {
  const { rows } = await db.admin.query("select 1 from auth.users where id = $1", [id]);
  return rows.length === 1;
}

async function countsFor(userId: string) {
  return Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await countOwned(db, t, userId)] as const)));
}

beforeEach(async () => {
  db = await createTestDb();
  a = await seedWorld(db, await db.createUser());
  b = await seedWorld(db, await db.createUser());
  // References that are `no action` rather than cascade: an item in an area, a subtask, a soft-deleted area.
  await db.asUser(a.userId, async (tx) => {
    await tx.query("update items set area_id = $1 where id = $2", [a.areaId, a.itemId]);
    await tx.query("insert into items (type, parent_id, area_id) values ('task', $1, $2)", [a.itemId, a.areaId]);
    await tx.query("update areas set deleted_at = now() where name = 'Health'");
  });
});

describe("delete_my_account", () => {
  it("removes the caller and every row they own, and leaves another user untouched", async () => {
    const before = await countsFor(b.userId);
    expect(Object.values(await countsFor(a.userId)).every((n) => n > 0)).toBe(true);

    await db.asUser(a.userId, (tx) => tx.query("select public.delete_my_account()"));

    expect(await userExists(a.userId)).toBe(false);
    expect(await countsFor(a.userId)).toEqual(Object.fromEntries(TABLES.map((t) => [t, 0])));
    expect(await userExists(b.userId)).toBe(true);
    expect(await countsFor(b.userId)).toEqual(before);
  });

  it("is denied to anon", async () => {
    await expect(db.asAnon((tx) => tx.query("select public.delete_my_account()"))).rejects.toThrow(/permission denied/);
    expect(await userExists(a.userId)).toBe(true);
  });

  it("raises when there is no user id, and deletes nothing", async () => {
    const users = async () => (await db.admin.query<{ n: number }>("select count(*)::int as n from auth.users")).rows[0].n;
    const total = await users();
    await expect(
      db.admin.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query("select public.delete_my_account()");
      }),
    ).rejects.toThrow(/needs a signed-in user/);
    expect(await users()).toBe(total);
  });

  it("grants execute to authenticated only", async () => {
    const { rows } = await db.admin.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
       where routine_schema = 'public' and routine_name = 'delete_my_account' and privilege_type = 'EXECUTE'
       order by grantee`,
    );
    // The owner keeps execute; nobody else but authenticated may call it.
    expect(rows.map((r) => r.grantee).filter((g) => g !== "postgres")).toEqual(["authenticated"]);
  });
});
