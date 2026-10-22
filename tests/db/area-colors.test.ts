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

describe("areas.color (0009)", () => {
  it("is null for the areas a new account starts with", async () => {
    const me = await db.createUser();
    expect(await colorsOf(me)).toEqual([
      { name: "Work", color: null },
      { name: "Home", color: null },
      { name: "Health", color: null },
    ]);
  });

  it("takes every palette name, and null again", async () => {
    const me = await db.createUser();
    for (const color of AREA_COLORS) {
      await setColor(me, color);
      expect((await colorsOf(me))[0].color).toBe(color);
    }
    await setColor(me, null);
    expect((await colorsOf(me))[0].color).toBeNull();
  });

  it.each(["red", "Clay", "", "#964b2c", "verdigris"])("refuses %j", async (color) => {
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
