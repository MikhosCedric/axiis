import type { TestDb } from "./harness";

export const TABLES = ["areas", "items", "links", "tags", "item_tags"] as const;
export type Table = (typeof TABLES)[number];

export type World = {
  userId: string;
  areaId: string;
  itemId: string;
  otherItemId: string;
  tagId: string;
};

/** One row in every table, written by the user themselves through RLS. */
export async function seedWorld(db: TestDb, userId: string): Promise<World> {
  return db.asUser(userId, async (tx) => {
    const one = async (sql: string, params: unknown[] = []) =>
      (await tx.query<{ id: string }>(sql, params)).rows[0].id;
    const areaId = await one("insert into areas (name) values ('Area') returning id");
    const itemId = await one("insert into items (type, title) values ('task', 'Item') returning id");
    const otherItemId = await one("insert into items (type, title) values ('note', 'Other') returning id");
    const tagId = await one("insert into tags (name) values ('tag') returning id");
    await tx.query("insert into links (from_id, to_id) values ($1, $2)", [otherItemId, itemId]);
    await tx.query("insert into item_tags (item_id, tag_id) values ($1, $2)", [itemId, tagId]);
    return { userId, areaId, itemId, otherItemId, tagId };
  });
}

export async function countOwned(db: TestDb, table: Table, userId: string): Promise<number> {
  const { rows } = await db.admin.query<{ n: number }>(`select count(*)::int as n from ${table} where user_id = $1`, [userId]);
  return rows[0].n;
}
