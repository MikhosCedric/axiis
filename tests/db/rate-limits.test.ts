import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type Tx } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

const RATE_LIMITED = { code: "54R01", message: expect.stringMatching(/^rate limited/) };

type Limited = {
  perMinute: number;
  /** Rows of this table that signup already made for a new user. */
  atSignup: number;
  /** Inserts `n` rows as the user in one statement, through Row Level Security. */
  add(tx: Tx, n: number): Promise<unknown>;
};

const LIMITED: Record<"items" | "links" | "tags" | "areas", Limited> = {
  items: {
    perMinute: 120,
    atSignup: 0,
    add: (tx, n) => tx.query("insert into items (type) select 'task' from generate_series(1, $1)", [n]),
  },
  links: {
    perMinute: 120,
    atSignup: 0,
    // Links are unique per pair, so this links the first note to the next n notes it is not yet linked to.
    add: (tx, n) =>
      tx.query(
        `with first as (select id from items where type = 'note' order by id limit 1)
         insert into links (from_id, to_id)
         select first.id, x.id from first, lateral (
           select i.id from items i where i.type = 'note' and i.id <> first.id
             and not exists (select 1 from links l where l.from_id = first.id and l.to_id = i.id)
           order by i.id limit $1) x`,
        [n],
      ),
  },
  tags: {
    perMinute: 60,
    atSignup: 0,
    add: (tx, n) => tx.query("insert into tags (name) select left('t' || gen_random_uuid(), 32) from generate_series(1, $1)", [n]),
  },
  areas: {
    perMinute: 30,
    atSignup: 3,
    add: (tx, n) => tx.query("insert into areas (name) select left('a' || gen_random_uuid(), 40) from generate_series(1, $1)", [n]),
  },
};

async function newUser(table: keyof typeof LIMITED): Promise<string> {
  const user = await db.createUser();
  if (table === "links") {
    await db.seed("insert into items (user_id, type, created_at) select $1, 'note', now() - interval '1 day' from generate_series(1, 400)", [user]);
  }
  return user;
}

const count = async (table: string, user: string) =>
  (await db.admin.query<{ n: number }>(`select count(*)::int as n from ${table} where user_id = $1`, [user])).rows[0].n;

describe.each(Object.entries(LIMITED) as [keyof typeof LIMITED, Limited][])("the %s rate limit", (table, { perMinute, atSignup, add }) => {
  const room = perMinute - atSignup;

  it(`accepts ${perMinute} rows in a minute, one statement at a time, and refuses the next`, async () => {
    const user = await newUser(table);
    for (let i = 0; i < room; i += 10) await db.asUser(user, (tx) => add(tx, Math.min(10, room - i)));
    const before = await count(table, user);
    await expect(db.asUser(user, (tx) => add(tx, 1))).rejects.toMatchObject(RATE_LIMITED);
    expect(await count(table, user)).toBe(before);
  });

  it("refuses a single statement over the limit, and keeps none of its rows", async () => {
    const user = await newUser(table);
    const before = await count(table, user);
    await expect(db.asUser(user, (tx) => add(tx, room + 1))).rejects.toMatchObject(RATE_LIMITED);
    expect(await count(table, user)).toBe(before);
  });

  it("leaves another user free to add rows", async () => {
    const busy = await newUser(table);
    await db.asUser(busy, (tx) => add(tx, room));
    const other = await newUser(table);
    await expect(db.asUser(other, (tx) => add(tx, 1))).resolves.toBeDefined();
  });
});

describe("the rate window", () => {
  it("forgets rows made more than a minute ago", async () => {
    const user = await db.createUser();
    await db.seed("insert into items (user_id, type, created_at) select $1, 'task', now() - interval '61 seconds' from generate_series(1, 500)", [user]);
    await expect(db.asUser(user, (tx) => LIMITED.items.add(tx, 120))).resolves.toBeDefined();
  });

  it("stamps created_at with the database's clock, whatever the client sends", async () => {
    const user = await db.createUser();
    const backdated = "insert into items (type, created_at) select 'task', '2000-01-01' from generate_series(1, 121)";
    await expect(db.asUser(user, (tx) => tx.query(backdated))).rejects.toMatchObject(RATE_LIMITED);
    await db.asUser(user, (tx) => tx.query("insert into items (type, created_at) values ('task', '2000-01-01')"));
    const { rows } = await db.admin.query<{ created_at: Date }>("select created_at from items where user_id = $1", [user]);
    expect(rows[0].created_at.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("keeps created_at when a client updates it", async () => {
    const user = await db.createUser();
    await db.asUser(user, (tx) => LIMITED.items.add(tx, 120));
    await db.asUser(user, (tx) => tx.query("update items set created_at = '2000-01-01'"));
    await expect(db.asUser(user, (tx) => LIMITED.items.add(tx, 1))).rejects.toMatchObject(RATE_LIMITED);
  });

  it("counts through the (user_id, created_at) index on a large table", async () => {
    for (let i = 0; i < 5; i++) {
      const user = await db.createUser();
      await db.seed("insert into items (user_id, type, created_at) select $1, 'task', now() - interval '1 day' from generate_series(1, 20000)", [user]);
    }
    await db.admin.exec("analyze items");
    const user = await db.createUser();
    const { rows } = await db.admin.query<{ "QUERY PLAN": string }>(
      "explain select 1 from items t where t.user_id = $1 and t.created_at > now() - interval '60 seconds' limit 121",
      [user],
    );
    expect(rows.map((r) => r["QUERY PLAN"]).join("\n")).toMatch(/items_user_created/);
  });
});

describe("app flows inside the limits", () => {
  it("signup's three areas leave room, and one capture's ten new tags fit", async () => {
    const user = await db.createUser();
    await expect(db.asUser(user, (tx) => LIMITED.tags.add(tx, 10))).resolves.toBeDefined();
    await expect(db.asUser(user, (tx) => LIMITED.areas.add(tx, 9))).resolves.toBeDefined();
  });

  it("lets a rate-limited account still update, delete and delete itself", async () => {
    const user = await db.createUser();
    await db.asUser(user, (tx) => LIMITED.items.add(tx, 120));
    await db.asUser(user, (tx) => tx.query("update items set title = 'renamed'"));
    await db.asUser(user, (tx) => tx.query("update items set deleted_at = now()"));
    await db.asUser(user, (tx) => tx.query("select public.delete_my_account()"));
    expect(await count("items", user)).toBe(0);
  });
});
