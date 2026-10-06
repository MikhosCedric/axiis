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

async function insert(userId: string, fields: Record<string, unknown>): Promise<string> {
  const cols = Object.keys(fields);
  const sql = `insert into items (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`;
  const { rows } = await db.asUser(userId, (tx) => tx.query<{ id: string }>(sql, Object.values(fields)));
  return rows[0].id;
}
const newItem = (fields: Record<string, unknown>) => insert(a.userId, fields);
const series = (fields: Record<string, unknown> = {}) =>
  newItem({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY", ...fields });
const UUID = /^[0-9a-f-]{36}$/;

describe("recurrence check constraints", () => {
  const cases: { name: string; constraint: string; bad: () => Promise<Record<string, unknown>>; good: () => Promise<Record<string, unknown>> }[] = [
    {
      name: "series_id without original_on",
      constraint: "items_series_pair",
      bad: async () => ({ type: "task", series_id: await series() }),
      good: async () => ({ type: "task", series_id: await series(), original_on: "2026-10-07" }),
    },
    {
      name: "original_on without series_id",
      constraint: "items_series_pair",
      bad: async () => ({ type: "task", original_on: "2026-10-07" }),
      good: async () => ({ type: "task" }),
    },
    {
      name: "an override that repeats",
      constraint: "items_override_not_recurring",
      bad: async () => ({ type: "task", series_id: await series(), original_on: "2026-10-07", scheduled_on: "2026-10-07", rrule: "FREQ=DAILY" }),
      good: async () => ({ type: "task", series_id: await series(), original_on: "2026-10-07", scheduled_on: "2026-10-07" }),
    },
    {
      name: "a repeating note",
      constraint: "items_note_not_recurring",
      bad: async () => ({ type: "note", rrule: "FREQ=DAILY" }),
      good: async () => ({ type: "event", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY" }),
    },
    {
      name: "a repeating item with no schedule",
      constraint: "items_recurring_scheduled",
      bad: async () => ({ type: "task", rrule: "FREQ=WEEKLY" }),
      good: async () => ({ type: "task", start_at: "2026-10-06T09:00:00Z", end_at: "2026-10-06T10:00:00Z", rrule: "FREQ=WEEKLY" }),
    },
    {
      name: "a repeating subtask",
      constraint: "items_recurring_top_level",
      bad: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY", parent_id: await newItem({ type: "task" }) }),
      good: async () => ({ type: "task", scheduled_on: "2026-10-06", parent_id: await newItem({ type: "task" }) }),
    },
    {
      name: "a rule outside the allowlist",
      constraint: "items_rrule_allowlist",
      bad: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO" }),
      good: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231" }),
    },
    {
      name: "a rule with both UNTIL and COUNT",
      constraint: "items_rrule_allowlist",
      bad: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY;UNTIL=20261231;COUNT=3" }),
      good: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY;COUNT=3" }),
    },
    {
      name: "a rule with interval zero",
      constraint: "items_rrule_allowlist",
      bad: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY;INTERVAL=0" }),
      good: async () => ({ type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=YEARLY;INTERVAL=99" }),
    },
  ];

  it.each(cases)("$name: rejected by $constraint", async ({ constraint, bad, good }) => {
    await expect(newItem(await bad())).rejects.toThrow(constraint);
    await expect(newItem(await good())).resolves.toMatch(UUID);
  });

  it("an override cannot replace itself", async () => {
    const id = await newItem({ type: "task" });
    await expect(asA("update items set series_id = id, original_on = '2026-10-06' where id = $1", [id])).rejects.toThrow();
    // The trigger refuses first; take it away to prove the check stands on its own.
    const outcome = await db.admin
      .transaction(async (tx) => {
        await tx.exec("alter table items disable trigger items_check_recurrence");
        await tx.query("update items set series_id = id, original_on = '2026-10-06' where id = $1", [id]);
      })
      .catch((e: Error) => e.message);
    expect(outcome).toMatch("items_not_own_series");
  });
});

describe("overrides", () => {
  it("one live override per occurrence", async () => {
    const master = await series();
    const first = await newItem({ type: "task", series_id: master, original_on: "2026-10-08" });
    await expect(newItem({ type: "task", series_id: master, original_on: "2026-10-08" })).rejects.toThrow("items_series_original");
    await expect(newItem({ type: "task", series_id: master, original_on: "2026-10-09" })).resolves.toMatch(UUID);
    // A soft-deleted override no longer holds the slot.
    await asA("update items set deleted_at = now() where id = $1", [first]);
    await expect(newItem({ type: "task", series_id: master, original_on: "2026-10-08" })).resolves.toMatch(UUID);
  });

  it("cannot point at another user's series", async () => {
    const theirs = await insert(b.userId, { type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY" });
    await expect(newItem({ type: "task", series_id: theirs, original_on: "2026-10-07" })).rejects.toThrow(/violates foreign key constraint/);
    await expect(
      db.admin.query("insert into items (user_id, type, series_id, original_on) values ($1, 'task', $2, '2026-10-07')", [a.userId, theirs]),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("cannot read or edit another user's overrides", async () => {
    const master = await insert(b.userId, { type: "task", scheduled_on: "2026-10-06", rrule: "FREQ=DAILY" });
    const theirs = await insert(b.userId, { type: "task", series_id: master, original_on: "2026-10-07" });
    const seen = await asA("select id from items where series_id = $1", [master]);
    expect(seen.rows).toHaveLength(0);
    const changed = await asA("update items set title = 'mine' where id = $1", [theirs]);
    expect(changed.affectedRows).toBe(0);
  });

  it("soft-deleting the series leaves its overrides in place", async () => {
    const master = await series();
    const override = await newItem({ type: "task", series_id: master, original_on: "2026-10-07", status: "done" });
    await asA("update items set deleted_at = now() where id = $1", [master]);
    const { rows } = await db.admin.query<{ deleted_at: string | null; series_id: string }>(
      "select deleted_at, series_id from items where id = $1",
      [override],
    );
    expect(rows).toEqual([{ deleted_at: null, series_id: master }]);
  });

  it("a hard delete of the series removes its overrides", async () => {
    const master = await series();
    const override = await newItem({ type: "task", series_id: master, original_on: "2026-10-07" });
    await asA("delete from items where id = $1", [master]);
    const { rows } = await db.admin.query("select id from items where id = $1", [override]);
    expect(rows).toHaveLength(0);
  });
});

describe("recurrence trigger", () => {
  it("an override must point at a repeating item", async () => {
    const plain = await newItem({ type: "task", scheduled_on: "2026-10-06" });
    await expect(newItem({ type: "task", series_id: plain, original_on: "2026-10-07" })).rejects.toThrow("must belong to a repeating item");
  });

  it("an override cannot be a note or a subtask", async () => {
    const master = await series();
    await expect(newItem({ type: "note", series_id: master, original_on: "2026-10-07" })).rejects.toThrow("a note cannot replace");
    const parent = await newItem({ type: "task" });
    await expect(newItem({ type: "task", series_id: master, original_on: "2026-10-07", parent_id: parent })).rejects.toThrow(
      "cannot be a subtask",
    );
    await expect(newItem({ type: "task", series_id: master, original_on: "2026-10-07" })).resolves.toMatch(UUID);
  });

  it("a repeating item cannot hold subtasks", async () => {
    const master = await series({ type: "checklist" });
    await expect(newItem({ type: "task", parent_id: master })).rejects.toThrow("cannot have subtasks");
    const override = await newItem({ type: "task", series_id: master, original_on: "2026-10-07" });
    await expect(newItem({ type: "task", parent_id: override })).rejects.toThrow("cannot have subtasks");
    const plain = await newItem({ type: "checklist" });
    await expect(newItem({ type: "task", parent_id: plain })).resolves.toMatch(UUID);
  });

  it("a parent cannot start repeating or become an override", async () => {
    const parent = await newItem({ type: "task", scheduled_on: "2026-10-06" });
    await newItem({ type: "task", parent_id: parent });
    await expect(asA("update items set rrule = 'FREQ=DAILY' where id = $1", [parent])).rejects.toThrow("cannot have subtasks");
    const master = await series();
    await expect(asA("update items set series_id = $1, original_on = '2026-10-07' where id = $2", [master, parent])).rejects.toThrow(
      "cannot have subtasks",
    );
    const lone = await newItem({ type: "task", scheduled_on: "2026-10-06" });
    await expect(asA("update items set rrule = 'FREQ=DAILY' where id = $1", [lone])).resolves.toBeDefined();
  });

  it("a series cannot stop repeating while it has live overrides", async () => {
    const master = await series();
    const override = await newItem({ type: "task", series_id: master, original_on: "2026-10-07" });
    await expect(asA("update items set rrule = null where id = $1", [master])).rejects.toThrow("detach the occurrences");
    await asA("update items set series_id = null, original_on = null where id = $1", [override]);
    await expect(asA("update items set rrule = null where id = $1", [master])).resolves.toBeDefined();
  });

  it("a series cannot be retyped as a note", async () => {
    const master = await series();
    await expect(asA("update items set type = 'note', scheduled_on = null where id = $1", [master])).rejects.toThrow("items_note_not_recurring");
    await expect(asA("update items set type = 'event' where id = $1", [master])).resolves.toBeDefined();
  });
});

describe("recurrence indexes", () => {
  it.each(["items_series_original", "items_user_series_masters", "items_user_original_on"])("has %s", async (name) => {
    const { rows } = await db.admin.query("select 1 from pg_indexes where schemaname = 'public' and indexname = $1", [name]);
    expect(rows).toHaveLength(1);
  });
});
