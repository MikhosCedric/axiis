import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type Tx } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

const OLD = "now() - interval '31 days'";
const RECENT = "now() - interval '29 days'";

/** Inserts one item for the user as the superuser and returns its id. */
async function item(userId: string, columns: Record<string, string> = {}): Promise<string> {
  const all = { user_id: "$1", type: "'task'", title: "'x'", ...columns };
  const [names, values] = [Object.keys(all), Object.values(all)];
  const { rows } = await db.admin.transaction(async (tx) => {
    await tx.exec("set local session_replication_role = replica");
    return tx.query<{ id: string }>(`insert into items (${names.join(", ")}) values (${values.join(", ")}) returning id`, [userId]);
  });
  return rows[0].id;
}

const purge = (userId: string) =>
  db.asUser(userId, async (tx) => (await tx.query<{ n: number }>("select public.purge_deleted_items() as n")).rows[0].n);

const exists = async (id: string) => (await db.admin.query("select 1 from items where id = $1", [id])).rows.length === 1;

describe("purge_deleted_items", () => {
  it("removes the caller's items soft-deleted more than 30 days ago, and nothing else", async () => {
    const me = await db.createUser();
    const other = await db.createUser();
    const old = await item(me, { deleted_at: OLD });
    const recent = await item(me, { deleted_at: RECENT });
    const live = await item(me);
    const othersOld = await item(other, { deleted_at: OLD });

    expect(await purge(me)).toBe(1);
    expect(await exists(old)).toBe(false);
    expect([await exists(recent), await exists(live), await exists(othersOld)]).toEqual([true, true, true]);
  });

  it("frees room for an account at its item cap", async () => {
    const me = await db.createUser();
    await db.seed(
      `insert into items (user_id, type, title, created_at, deleted_at)
       select $1, 'task', 'x', now() - interval '40 days', case when g <= 100 then ${OLD} end from generate_series(1, 20000) g`,
      [me],
    );
    const addOne = (tx: Tx) => tx.query("insert into items (type) values ('task')");
    await expect(db.asUser(me, addOne)).rejects.toMatchObject({ code: "54000" });
    expect(await purge(me)).toBe(100);
    await expect(db.asUser(me, addOne)).resolves.toBeDefined();
  });

  it("removes at most 500 a call, oldest first", async () => {
    const me = await db.createUser();
    await db.seed(
      `insert into items (user_id, type, title, deleted_at)
       select $1, 'task', g::text, now() - interval '31 days' - g * interval '1 minute' from generate_series(1, 501) g`,
      [me],
    );
    expect(await purge(me)).toBe(500);
    const { rows } = await db.admin.query<{ title: string }>("select title from items where user_id = $1", [me]);
    expect(rows).toEqual([{ title: "1" }]);
    expect(await purge(me)).toBe(1);
  });

  it("takes the item's links and tags with it", async () => {
    const me = await db.createUser();
    const old = await item(me, { deleted_at: OLD, type: "'note'" });
    const live = await item(me, { type: "'note'" });
    await db.seed("insert into links (user_id, from_id, to_id) values ($1, $2, $3), ($1, $3, $2)", [me, old, live]);
    await db.seed("insert into tags (user_id, name) values ($1, 'kept')", [me]);
    await db.seed("insert into item_tags (user_id, item_id, tag_id) select $1, $2, id from tags where user_id = $1", [me, old]);

    expect(await purge(me)).toBe(1);
    const { rows } = await db.admin.query<{ n: number }>(
      "select (select count(*) from links where user_id = $1)::int + (select count(*) from item_tags where user_id = $1)::int as n",
      [me],
    );
    expect(rows[0].n).toBe(0);
    expect(await exists(live)).toBe(true);
    expect((await db.admin.query("select 1 from tags where user_id = $1", [me])).rows).toHaveLength(1);
  });

  it("keeps a parent while one of its subtasks is kept, and takes both once both are old", async () => {
    const me = await db.createUser();
    const parent = await item(me, { deleted_at: OLD });
    const child = await item(me, { deleted_at: RECENT, parent_id: `'${parent}'` });

    expect(await purge(me)).toBe(0);
    expect([await exists(parent), await exists(child)]).toEqual([true, true]);

    await db.admin.query(`update items set deleted_at = ${OLD} where id = $1`, [child]);
    expect(await purge(me)).toBe(2);
    expect([await exists(parent), await exists(child)]).toEqual([false, false]);
  });

  it("detaches the overrides a purged series leaves behind instead of deleting them", async () => {
    const me = await db.createUser();
    const series = await item(me, { deleted_at: OLD, rrule: "'FREQ=DAILY'", scheduled_on: "'2026-01-01'" });
    const kept = await item(me, { series_id: `'${series}'`, original_on: "'2026-01-03'", scheduled_on: "'2026-01-04'", title: "'kept'" });
    const gone = await item(me, { series_id: `'${series}'`, original_on: "'2026-01-05'", scheduled_on: "'2026-01-05'", deleted_at: OLD });

    expect(await purge(me)).toBe(2);
    expect([await exists(series), await exists(gone)]).toEqual([false, false]);
    const { rows } = await db.admin.query("select title, series_id, original_on, scheduled_on::text from items where id = $1", [kept]);
    expect(rows).toEqual([{ title: "kept", series_id: null, original_on: null, scheduled_on: "2026-01-04" }]);
  });

  it("does nothing for anon, and is executable by authenticated only, as the caller", async () => {
    await expect(db.asAnon((tx) => tx.query("select public.purge_deleted_items()"))).rejects.toThrow(/permission denied/);
    const { rows } = await db.admin.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
       where routine_schema = 'public' and routine_name = 'purge_deleted_items' and privilege_type = 'EXECUTE'`,
    );
    expect(rows.map((r) => r.grantee).filter((g) => g !== "postgres")).toEqual(["authenticated"]);
    const definer = await db.admin.query("select prosecdef from pg_proc where proname = 'purge_deleted_items'");
    expect(definer.rows).toEqual([{ prosecdef: false }]);
  });
});
