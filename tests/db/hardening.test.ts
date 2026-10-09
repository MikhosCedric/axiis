import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
let userId: string;

beforeAll(async () => {
  db = await createTestDb();
  userId = await db.createUser();
});

const run = (sql: string, params: unknown[] = []) => db.asUser(userId, (tx) => tx.query(sql, params));

describe("indexes that cover foreign keys", () => {
  it.each(["items_user_series", "item_tags_user_item", "links_user_from"])("has %s", async (name) => {
    const { rows } = await db.admin.query("select 1 from pg_indexes where schemaname = 'public' and indexname = $1", [name]);
    expect(rows).toHaveLength(1);
  });
});

describe("area names", () => {
  it("refuses a second live area with the same name in any case", async () => {
    await run("insert into areas (name) values ('Studio')");
    await expect(run("insert into areas (name) values ('STUDIO')")).rejects.toThrow(/areas_user_name_live/);
  });

  it("allows the name again once the first area is soft-deleted", async () => {
    await run("insert into areas (name) values ('Garden')");
    await run("update areas set deleted_at = now() where name = 'Garden'");
    await expect(run("insert into areas (name) values ('Garden')")).resolves.toBeDefined();
  });

  it("lets two users each have an area with the same name", async () => {
    const other = await db.createUser();
    await db.asUser(other, (tx) => tx.query("insert into areas (name) values ('Studio')"));
  });
});

describe("text bounds", () => {
  const cases: [string, string, unknown[], string][] = [
    ["a 501-character title", "insert into items (type, title) values ('task', $1)", ["x".repeat(501)], "items_title_length"],
    ["an empty area name", "insert into areas (name) values ('')", [], "areas_name_length"],
    ["a 41-character area name", "insert into areas (name) values ($1)", ["x".repeat(41)], "areas_name_length"],
    ["a 33-character tag", "insert into tags (name) values ($1)", ["x".repeat(33)], "tags_name_length"],
    ["a 3 MB body", "insert into items (type, title, body) values ('note', 'n', to_jsonb($1::text))", ["x".repeat(3 * 1024 * 1024)], "items_body_size"],
  ];

  it.each(cases)("refuses %s", async (_name, sql, params, constraint) => {
    await expect(run(sql, params)).rejects.toThrow(new RegExp(constraint));
  });

  it.each([
    ["a 500-character title", "insert into items (type, title) values ('task', $1)", ["x".repeat(500)]],
    ["a 40-character area name", "insert into areas (name) values ($1)", ["y".repeat(40)]],
    ["a 32-character tag", "insert into tags (name) values ($1)", ["z".repeat(32)]],
  ])("accepts %s", async (_name, sql, params) => {
    await expect(run(sql, params)).resolves.toBeDefined();
  });
});
