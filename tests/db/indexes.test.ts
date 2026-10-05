import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

describe("indexes that back product queries", () => {
  it.each(["links_user_to", "item_tags_user_tag", "items_user_start_at", "items_user_scheduled_on", "items_user_parent"])(
    "has %s",
    async (name) => {
      const { rows } = await db.admin.query<{ indexname: string }>("select indexname from pg_indexes where schemaname = 'public' and indexname = $1", [name]);
      expect(rows).toHaveLength(1);
    },
  );
});
