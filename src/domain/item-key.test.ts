import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "./item";
import { occurrenceKey, parseItemKey } from "./item-key";

const ID = "6f9619ff-8b86-4011-b42d-00c04fc964ff" as ItemId;

describe("parseItemKey", () => {
  it("reads a stored item id", () => {
    expect(parseItemKey(ID)).toEqual({ kind: "item", id: ID });
  });

  it("reads an occurrence key and round-trips it", () => {
    const key = occurrenceKey(ID, "2026-10-06" as LocalDate);
    expect(key).toBe(`${ID}~2026-10-06`);
    expect(parseItemKey(key)).toEqual({ kind: "occurrence", seriesId: ID, originalOn: "2026-10-06" });
  });

  it.each([
    ["not a string", 42],
    ["empty", ""],
    ["not a uuid", "abc"],
    ["a bad series id", "abc~2026-10-06"],
    ["no date", `${ID}~`],
    ["not a real date", `${ID}~2026-02-30`],
    ["two tildes", `${ID}~2026-10-06~x`],
    ["a date with a time", `${ID}~2026-10-06T09:00`],
  ])("rejects %s", (_, raw) => {
    expect(parseItemKey(raw)).toBeNull();
  });
});
