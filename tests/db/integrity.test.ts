import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";
import { seedWorld, type World } from "./fixtures";

let db: TestDb;
let a: World;
let b: World;

beforeAll(async () => {
  db = await createTestDb();
  a = await seedWorld(db, await db.createUser());
  b = await seedWorld(db, await db.createUser());
});

const asA = (sql: string, params: unknown[] = []) => db.asUser(a.userId, (tx) => tx.query(sql, params));

async function newItem(fields: Record<string, unknown>): Promise<string> {
  const cols = Object.keys(fields);
  const sql = `insert into items (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`;
  const { rows } = await db.asUser(a.userId, (tx) => tx.query<{ id: string }>(sql, Object.values(fields)));
  return rows[0].id;
}

// Runs as superuser so RLS is out of the picture: only the composite key can reject.
describe("composite foreign keys reject cross-user references", () => {
  const fk = /violates foreign key constraint/;
  const asAdmin = (sql: string, params: unknown[]) => db.admin.query(sql, params);

  it("item -> another user's area", async () => {
    await expect(asAdmin("insert into items (user_id, type, area_id) values ($1, 'task', $2)", [a.userId, b.areaId])).rejects.toThrow(fk);
    await expect(asAdmin("insert into items (user_id, type, area_id) values ($1, 'task', $2)", [a.userId, a.areaId])).resolves.toBeDefined();
  });

  it("item -> another user's parent", async () => {
    await expect(asAdmin("insert into items (user_id, type, parent_id) values ($1, 'task', $2)", [a.userId, b.itemId])).rejects.toThrow(fk);
    await expect(asAdmin("insert into items (user_id, type, parent_id) values ($1, 'task', $2)", [a.userId, a.itemId])).resolves.toBeDefined();
  });

  it("link from or to another user's item", async () => {
    const sql = "insert into links (user_id, from_id, to_id) values ($1, $2, $3)";
    await expect(asAdmin(sql, [a.userId, b.otherItemId, a.itemId])).rejects.toThrow(fk);
    await expect(asAdmin(sql, [a.userId, a.otherItemId, b.itemId])).rejects.toThrow(fk);
    await expect(asAdmin(sql, [a.userId, a.itemId, a.otherItemId])).resolves.toBeDefined();
  });

  it("item_tag on another user's item or tag", async () => {
    const sql = "insert into item_tags (user_id, item_id, tag_id) values ($1, $2, $3)";
    await expect(asAdmin(sql, [a.userId, a.otherItemId, b.tagId])).rejects.toThrow(fk);
    await expect(asAdmin(sql, [a.userId, b.otherItemId, a.tagId])).rejects.toThrow(fk);
    await expect(asAdmin(sql, [a.userId, a.otherItemId, a.tagId])).resolves.toBeDefined();
  });
});

describe("item check constraints", () => {
  const start = "2026-10-06T09:00:00Z";
  const end = "2026-10-06T10:00:00Z";
  const cases: { name: string; constraint: string; bad: Record<string, unknown>; good: Record<string, unknown> }[] = [
    {
      name: "timed and day-only plans are exclusive",
      constraint: "items_plan_exclusive",
      bad: { type: "task", start_at: start, end_at: end, scheduled_on: "2026-10-06" },
      good: { type: "task", start_at: start, end_at: end },
    },
    {
      name: "start_at without end_at",
      constraint: "items_timed_pair",
      bad: { type: "event", start_at: start },
      good: { type: "task", scheduled_on: "2026-10-06" },
    },
    {
      name: "end_at without start_at",
      constraint: "items_timed_pair",
      bad: { type: "event", end_at: end },
      good: { type: "event" },
    },
    {
      name: "end_at equal to start_at",
      constraint: "items_timed_order",
      bad: { type: "event", start_at: start, end_at: start },
      good: { type: "event", start_at: start, end_at: end },
    },
    {
      name: "end_at before start_at",
      constraint: "items_timed_order",
      bad: { type: "event", start_at: end, end_at: start },
      good: { type: "event", start_at: start, end_at: end },
    },
    {
      name: "a note with a day",
      constraint: "items_note_unscheduled",
      bad: { type: "note", scheduled_on: "2026-10-06" },
      good: { type: "task", scheduled_on: "2026-10-06" },
    },
    {
      name: "a note with a due date",
      constraint: "items_note_unscheduled",
      bad: { type: "note", due_on: "2026-10-06" },
      good: { type: "note" },
    },
    {
      name: "a note with a time",
      constraint: "items_note_unscheduled",
      bad: { type: "note", start_at: start, end_at: end },
      good: { type: "event", start_at: start, end_at: end },
    },
  ];

  it.each(cases)("$name: rejected by $constraint", async ({ constraint, bad, good }) => {
    await expect(newItem(bad)).rejects.toThrow(constraint);
    await expect(newItem(good)).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("an item cannot be its own parent", async () => {
    const id = await newItem({ type: "task" });
    await expect(asA("update items set parent_id = id where id = $1", [id])).rejects.toThrow("items_not_own_parent");
  });

  it("title defaults to empty, never null", async () => {
    const id = await newItem({ type: "task" });
    const { rows } = await db.admin.query<{ title: string }>("select title from items where id = $1", [id]);
    expect(rows[0].title).toBe("");
    await expect(newItem({ type: "task", title: null })).rejects.toThrow(/not-null/);
  });
});

describe("link and tag constraints", () => {
  it("a link cannot point at its own source", async () => {
    await expect(asA("insert into links (from_id, to_id) values ($1, $1)", [a.itemId])).rejects.toThrow("links_not_self");
  });

  it("a link is unique per (from, to, kind)", async () => {
    const [from, to] = [await newItem({ type: "note" }), await newItem({ type: "task" })];
    await asA("insert into links (from_id, to_id) values ($1, $2)", [from, to]);
    await expect(asA("insert into links (from_id, to_id) values ($1, $2)", [from, to])).rejects.toThrow(/duplicate key/);
    await expect(asA("insert into links (from_id, to_id) values ($1, $2)", [to, from])).resolves.toBeDefined();
  });

  it("tag names are unique per user, ignoring case", async () => {
    await asA("insert into tags (name) values ('Errands')");
    await expect(asA("insert into tags (name) values ('errands')")).rejects.toThrow("tags_user_name_ci");
    await expect(db.asUser(b.userId, (tx) => tx.query("insert into tags (name) values ('errands')"))).resolves.toBeDefined();
  });

  it("an item carries a tag once", async () => {
    await expect(asA("insert into item_tags (item_id, tag_id) values ($1, $2)", [a.itemId, a.tagId])).rejects.toThrow(/duplicate key/);
  });
});

describe("subtask hierarchy", () => {
  const hierarchy = /cannot have a parent|cannot be a parent|at most two levels/;

  it.each(["task", "checklist"])("a %s may be a parent of a task", async (type) => {
    const parent = await newItem({ type });
    await expect(newItem({ type: "task", parent_id: parent })).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each(["note", "event"])("a %s cannot have a parent", async (type) => {
    const parent = await newItem({ type: "task" });
    await expect(newItem({ type, parent_id: parent })).rejects.toThrow(`a ${type} cannot have a parent`);
  });

  it.each(["note", "event"])("a %s cannot be a parent", async (type) => {
    const parent = await newItem({ type });
    await expect(newItem({ type: "task", parent_id: parent })).rejects.toThrow(`a ${type} cannot be a parent`);
  });

  it("rejects a third level", async () => {
    const root = await newItem({ type: "task" });
    const child = await newItem({ type: "task", parent_id: root });
    await expect(newItem({ type: "task", parent_id: child })).rejects.toThrow("at most two levels");
  });

  it("rejects moving a parent under another item", async () => {
    const root = await newItem({ type: "task" });
    const parent = await newItem({ type: "task" });
    await newItem({ type: "task", parent_id: parent });
    await expect(asA("update items set parent_id = $1 where id = $2", [root, parent])).rejects.toThrow("at most two levels");
  });

  it("rejects turning a parent into a note", async () => {
    const parent = await newItem({ type: "checklist" });
    await newItem({ type: "task", parent_id: parent });
    await expect(asA("update items set type = 'note' where id = $1", [parent])).rejects.toThrow(hierarchy);
    await expect(asA("update items set type = 'task' where id = $1", [parent])).resolves.toBeDefined();
  });

  it("rejects turning a subtask into an event", async () => {
    const parent = await newItem({ type: "task" });
    const child = await newItem({ type: "task", parent_id: parent });
    await expect(asA("update items set type = 'event' where id = $1", [child])).rejects.toThrow("cannot have a parent");
  });
});
