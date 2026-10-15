import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

/** Seeds tags and items for a user; each item is tagged with every tag named in `tags`. */
async function seedTagged(userId: string, items: { status?: string; deleted?: boolean; tags: string[] }[], tagNames: string[]) {
  await db.seed("insert into tags (user_id, name) select $1, unnest($2::text[])", [userId, tagNames]);
  for (const [i, item] of items.entries()) {
    await db.seed(
      `with it as (
         insert into items (user_id, type, title, status, deleted_at)
         values ($1, 'task', $2, $3::item_status, case when $4 then now() else null end) returning id
       )
       insert into item_tags (user_id, item_id, tag_id)
       select $1, it.id, t.id from it, tags t where t.user_id = $1 and t.name = any($5::text[])`,
      [userId, `item ${i}`, item.status ?? "open", item.deleted ?? false, item.tags],
    );
  }
}

const countsAs = (userId: string) =>
  db.asUser(userId, async (tx) => {
    const { rows } = await tx.query<{ name: string; open: number }>(
      "select t.name, c.open from public.tag_open_counts() c join tags t on t.id = c.tag_id order by t.name",
    );
    return rows;
  });

describe("tag_open_counts", () => {
  it("counts each tag's open, live items for the caller only, leaving out tags with none", async () => {
    const me = await db.createUser();
    const other = await db.createUser();
    await seedTagged(
      me,
      [
        { tags: ["deep", "home"] },
        { tags: ["deep"] },
        { status: "done", tags: ["deep", "done-only"] },
        { status: "dropped", tags: ["home"] },
        { deleted: true, tags: ["home", "deleted-only"] },
      ],
      ["deep", "home", "done-only", "deleted-only", "unused"],
    );
    await seedTagged(other, [{ tags: ["deep"] }, { tags: ["deep"] }, { tags: ["deep"] }], ["deep"]);

    expect(await countsAs(me)).toEqual([
      { name: "deep", open: 2 },
      { name: "home", open: 1 },
    ]);
    expect(await countsAs(other)).toEqual([{ name: "deep", open: 3 }]);
  });

  it("is denied to anon, and executable by authenticated only", async () => {
    await expect(db.asAnon((tx) => tx.query("select * from public.tag_open_counts()"))).rejects.toThrow(/permission denied/);
    const { rows } = await db.admin.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
       where routine_schema = 'public' and routine_name = 'tag_open_counts' and privilege_type = 'EXECUTE'`,
    );
    expect(rows.map((r) => r.grantee).filter((g) => g !== "postgres")).toEqual(["authenticated"]);
  });

  it("runs as the caller, so Row Level Security still applies", async () => {
    const { rows } = await db.admin.query<{ secdef: boolean }>("select prosecdef as secdef from pg_proc where proname = 'tag_open_counts'");
    expect(rows).toEqual([{ secdef: false }]);
  });
});
