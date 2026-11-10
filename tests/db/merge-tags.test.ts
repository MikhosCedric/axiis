import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

async function tagIds(userId: string, names: string[]): Promise<Record<string, string>> {
  await db.seed("insert into tags (user_id, name) select $1, unnest($2::text[])", [userId, names]);
  const { rows } = await db.admin.query<{ id: string; name: string }>("select id, name from tags where user_id = $1", [userId]);
  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

/** Seeds `count` items, each wearing every tag id given. */
async function seedItems(userId: string, count: number, tags: string[]) {
  await db.seed(
    `with it as (
       insert into items (user_id, type, title) select $1, 'task', 'item ' || g from generate_series(1, $2) g returning id
     )
     insert into item_tags (user_id, item_id, tag_id) select $1, it.id, t from it, unnest($3::uuid[]) t`,
    [userId, count, tags],
  );
}

const merge = (userId: string, source: string, target: string) =>
  db.asUser(userId, async (tx) => (await tx.query<{ n: number }>("select public.merge_tags($1, $2) as n", [source, target])).rows[0].n);

async function namesOnItems(userId: string): Promise<string[][]> {
  const { rows } = await db.admin.query<{ names: string[] }>(
    `select array_agg(t.name order by t.name) as names from items i
     left join item_tags it on it.item_id = i.id left join tags t on t.id = it.tag_id
     where i.user_id = $1 group by i.id order by i.id`,
    [userId],
  );
  return rows.map((r) => r.names);
}

describe("merge_tags", () => {
  it("moves every item past any read cap, keeps one target on items that wore both, and deletes the source", async () => {
    const me = await db.createUser();
    const t = await tagIds(me, ["errand", "errands", "home"]);
    await seedItems(me, 1200, [t.errand]);
    await seedItems(me, 3, [t.errand, t.errands, t.home]);
    await seedItems(me, 2, [t.errands]);

    expect(await merge(me, t.errand, t.errands)).toBe(1203);

    const names = await namesOnItems(me);
    expect(names).toHaveLength(1205);
    expect(names.filter((n) => n.join() === "errands")).toHaveLength(1202);
    expect(names.filter((n) => n.join() === "errands,home")).toHaveLength(3);
    const { rows } = await db.admin.query<{ name: string }>("select name from tags where user_id = $1 order by name", [me]);
    expect(rows.map((r) => r.name)).toEqual(["errands", "home"]);
  });

  it("never goes over the per-item tag quota, since no row is added", async () => {
    const me = await db.createUser();
    const names = Array.from({ length: 20 }, (_, i) => `t${String(i).padStart(2, "0")}`);
    const t = await tagIds(me, names);
    await seedItems(me, 1, Object.values(t));
    expect(await merge(me, t.t00, t.t01)).toBe(1);
    expect((await namesOnItems(me))[0]).toHaveLength(19);
  });

  it("refuses a tag of another user, a missing tag and a merge into itself, changing nothing", async () => {
    const me = await db.createUser();
    const other = await db.createUser();
    const mine = await tagIds(me, ["a", "b"]);
    const theirs = await tagIds(other, ["c"]);
    await seedItems(other, 2, [theirs.c]);

    await expect(merge(me, theirs.c, mine.a)).rejects.toThrow(/tag not found/);
    await expect(merge(me, mine.a, theirs.c)).rejects.toThrow(/tag not found/);
    await expect(merge(me, mine.a, "00000000-0000-4000-a000-000000000000")).rejects.toThrow(/tag not found/);
    await expect(merge(me, mine.a, mine.a)).rejects.toThrow(/itself/);
    expect(await namesOnItems(other)).toEqual([["c"], ["c"]]);
  });

  it("is denied to anon, executable by authenticated only, and runs as the caller", async () => {
    await expect(db.asAnon((tx) => tx.query("select public.merge_tags(gen_random_uuid(), gen_random_uuid())"))).rejects.toThrow(
      /permission denied/,
    );
    const { rows } = await db.admin.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
       where routine_schema = 'public' and routine_name = 'merge_tags' and privilege_type = 'EXECUTE'`,
    );
    expect(rows.map((r) => r.grantee).filter((g) => g !== "postgres")).toEqual(["authenticated"]);
    const def = await db.admin.query<{ secdef: boolean }>("select prosecdef as secdef from pg_proc where proname = 'merge_tags'");
    expect(def.rows).toEqual([{ secdef: false }]);
  });
});
