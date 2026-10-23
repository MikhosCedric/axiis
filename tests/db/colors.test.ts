import { beforeAll, describe, expect, it } from "vitest";
import { AREA_COLORS } from "@/domain/area-color";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

const colorsOf = (userId: string) =>
  db.asUser(userId, async (tx) => {
    const { rows } = await tx.query<{ name: string; color: string | null }>("select name, color from areas order by position");
    return rows;
  });

const setColor = (userId: string, color: string | null, name = "Work") =>
  db.asUser(userId, (tx) => tx.query("update areas set color = $1 where name = $2", [color, name]));

describe("areas.color (0009, palette widened by 0011)", () => {
  it("is null for the areas a new account starts with", async () => {
    const me = await db.createUser();
    expect(await colorsOf(me)).toEqual([
      { name: "Work", color: null },
      { name: "Home", color: null },
      { name: "Health", color: null },
    ]);
  });

  it("takes every palette name, the four new ones included, and null again", async () => {
    const me = await db.createUser();
    for (const color of AREA_COLORS) {
      await setColor(me, color);
      expect((await colorsOf(me))[0].color).toBe(color);
    }
    await setColor(me, null);
    expect((await colorsOf(me))[0].color).toBeNull();
  });

  it.each(["red", "Clay", "", "#964b2c", "verdigris", "teal"])("refuses %j", async (color) => {
    const me = await db.createUser();
    await expect(setColor(me, color)).rejects.toThrow(/areas_color_palette/);
  });

  it("leaves another user's areas alone", async () => {
    const me = await db.createUser();
    const other = await db.createUser();
    const result = await db.asUser(me, (tx) => tx.query("update areas set color = 'plum' where user_id = $1", [other]));
    expect(result.affectedRows).toBe(0);
    expect((await colorsOf(other)).every((a) => a.color === null)).toBe(true);
  });
});

const addTag = (userId: string, name: string) =>
  db.asUser(userId, async (tx) => (await tx.query<{ id: string; color: string | null }>("insert into tags (name) values ($1) returning id, color", [name])).rows[0]);

const setTagColor = (userId: string, id: string, color: string | null) =>
  db.asUser(userId, (tx) => tx.query("update tags set color = $1 where id = $2", [color, id]));

const tagColor = (userId: string, id: string) =>
  db.asUser(userId, async (tx) => (await tx.query<{ color: string | null }>("select color from tags where id = $1", [id])).rows[0]?.color);

describe("tags.color (0011)", () => {
  it("is null for a new tag", async () => {
    const me = await db.createUser();
    expect((await addTag(me, "errands")).color).toBeNull();
  });

  it("takes every palette name, and null again", async () => {
    const me = await db.createUser();
    const { id } = await addTag(me, "deep");
    for (const color of AREA_COLORS) {
      await setTagColor(me, id, color);
      expect(await tagColor(me, id)).toBe(color);
    }
    await setTagColor(me, id, null);
    expect(await tagColor(me, id)).toBeNull();
  });

  it.each(["red", "Moss", "", "#485320", "verdigris"])("refuses %j", async (color) => {
    const me = await db.createUser();
    const { id } = await addTag(me, "home");
    await expect(setTagColor(me, id, color)).rejects.toThrow(/tags_color_palette/);
  });

  it("leaves another user's tags alone", async () => {
    const me = await db.createUser();
    const other = await db.createUser();
    const { id } = await addTag(other, "theirs");
    const result = await db.asUser(me, (tx) => tx.query("update tags set color = 'moss' where id = $1", [id]));
    expect(result.affectedRows).toBe(0);
    expect(await tagColor(other, id)).toBeNull();
  });
});
