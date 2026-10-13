import { beforeAll, describe, expect, it } from "vitest";
import { BODY_MAX_BYTES, parseBody } from "@/features/notes/doc";
import { createTestDb, type TestDb, type Tx } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

const QUOTA = { code: "54000", message: expect.stringMatching(/^quota exceeded/) };

type Capped = {
  cap: number;
  /** Adds `n` rows for the user in one statement, as the superuser. */
  fill(userId: string, n: number): Promise<void>;
  /** Inserts one more row as the user, through Row Level Security. */
  addOne(tx: Tx): Promise<unknown>;
};

const bulk = (sql: string) => async (userId: string, n: number) => {
  await db.admin.query(sql, [userId, n]);
};

const CAPPED: Record<"items" | "links" | "tags" | "areas", Capped> = {
  items: {
    cap: 20000,
    fill: bulk("insert into items (user_id, type, title) select $1, 'task', 'x' from generate_series(1, $2)"),
    addOne: (tx) => tx.query("insert into items (type) values ('task')"),
  },
  tags: {
    cap: 500,
    fill: bulk("insert into tags (user_id, name) select $1, 'f' || g from generate_series(1, $2) g"),
    addOne: (tx) => tx.query("insert into tags (name) values (left('extra' || gen_random_uuid(), 32))"),
  },
  areas: {
    cap: 100,
    // Signup already seeded three areas.
    fill: (userId, n) => bulk("insert into areas (user_id, name) select $1, 'f' || g from generate_series(1, $2 - 3) g")(userId, n),
    addOne: (tx) => tx.query("insert into areas (name) values (left('extra' || gen_random_uuid(), 40))"),
  },
  links: {
    cap: 50000,
    async fill(userId, n) {
      await db.admin.query("insert into items (user_id, type) select $1, 'note' from generate_series(1, 250)", [userId]);
      await db.admin.query(
        `insert into links (user_id, from_id, to_id)
         select $1, a.id, b.id from items a join items b on b.user_id = a.user_id and b.id <> a.id
         where a.user_id = $1 limit $2`,
        [userId, n],
      );
    },
    async addOne(tx) {
      const { rows } = await tx.query<{ id: string }>("insert into items (type) values ('note'), ('note') returning id");
      return tx.query("insert into links (from_id, to_id) values ($1, $2)", [rows[0].id, rows[1].id]);
    },
  },
};

describe.each(Object.entries(CAPPED))("the %s quota", (table, { cap, fill, addOne }) => {
  it(`accepts the row that reaches ${cap} and refuses the next`, async () => {
    const user = await db.createUser();
    await fill(user, cap - 1);
    await db.asUser(user, addOne);
    await expect(db.asUser(user, addOne)).rejects.toMatchObject(QUOTA);
    const { rows } = await db.admin.query<{ n: number }>(`select count(*)::int as n from ${table} where user_id = $1`, [user]);
    expect(rows[0].n).toBe(cap);
  });

  it("leaves another user free to add rows", async () => {
    const full = await db.createUser();
    await fill(full, cap);
    const other = await db.createUser();
    await expect(db.asUser(other, addOne)).resolves.toBeDefined();
  });
});

describe("how the quota counts", () => {
  it("counts soft-deleted items", async () => {
    const user = await db.createUser();
    await CAPPED.items.fill(user, 20000);
    await db.admin.query("update items set deleted_at = now() where user_id = $1", [user]);
    await expect(db.asUser(user, CAPPED.items.addOne)).rejects.toMatchObject(QUOTA);
  });

  it("refuses a bulk insert that would cross the cap, and keeps none of its rows", async () => {
    const user = await db.createUser();
    await CAPPED.tags.fill(user, 495);
    const tenMore = "insert into tags (name) select 'bulk' || g from generate_series(1, 10) g";
    await expect(db.asUser(user, (tx) => tx.query(tenMore))).rejects.toMatchObject(QUOTA);
    const { rows } = await db.admin.query<{ n: number }>("select count(*)::int as n from tags where user_id = $1", [user]);
    expect(rows[0].n).toBe(495);
  });

  it("allows 20 tags on one item, refuses a 21st, and leaves the next item free", async () => {
    const user = await db.createUser();
    await CAPPED.tags.fill(user, 21);
    await db.asUser(user, async (tx) => {
      await tx.query("insert into items (type, title) values ('task', 'first'), ('task', 'second')");
      await tx.query(
        `insert into item_tags (item_id, tag_id)
         select i.id, t.id from items i, (select id from tags order by name limit 20) t where i.title = 'first'`,
      );
    });
    const tagOne = (title: string) =>
      db.asUser(user, (tx) =>
        tx.query(
          `insert into item_tags (item_id, tag_id)
           select i.id, t.id from items i, tags t
           where i.title = $1 and t.id not in (select tag_id from item_tags where item_id = i.id) limit 1`,
          [title],
        ),
      );
    await expect(tagOne("first")).rejects.toMatchObject(QUOTA);
    await expect(tagOne("second")).resolves.toBeDefined();
  });
});

describe("paths that do not add rows for a user", () => {
  it("still seeds the three default areas on signup", async () => {
    const user = await db.createUser();
    const { rows } = await db.admin.query<{ n: number }>("select count(*)::int as n from areas where user_id = $1", [user]);
    expect(rows[0].n).toBe(3);
  });

  it("lets an account at its item cap delete itself", async () => {
    const user = await db.createUser();
    await CAPPED.items.fill(user, 20000);
    await db.asUser(user, (tx) => tx.query("select public.delete_my_account()"));
    const { rows } = await db.admin.query("select 1 from items where user_id = $1", [user]);
    expect(rows).toHaveLength(0);
  });
});

describe("the note body cap", () => {
  // The heaviest jsonb per JSON byte the editor can send: one-letter paragraphs with two marks each.
  function editorMaxDoc() {
    const para = { type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }, { type: "italic" }] }] };
    const content: unknown[] = [];
    while (JSON.stringify({ type: "doc", content: [...content, para] }).length <= BODY_MAX_BYTES) content.push(para);
    return { type: "doc", content };
  }

  it("accepts the largest body the editor saves", async () => {
    const parsed = parseBody(editorMaxDoc());
    expect(parsed.ok).toBe(true);
    const user = await db.createUser();
    const save = db.asUser(user, (tx) =>
      tx.query("insert into items (type, title, body) values ('note', 'n', $1::jsonb)", [JSON.stringify(parsed.ok && parsed.doc)]),
    );
    await expect(save).resolves.toBeDefined();
  });

  it("refuses a body over 512 KB", async () => {
    const user = await db.createUser();
    const save = db.asUser(user, (tx) =>
      tx.query("insert into items (type, title, body) values ('note', 'n', to_jsonb($1::text))", ["x".repeat(512 * 1024)]),
    );
    await expect(save).rejects.toThrow(/items_body_size/);
  });
});
