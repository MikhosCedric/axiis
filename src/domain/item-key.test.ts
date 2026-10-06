import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "./item";
import { makeItem } from "@/features/today/test-support";
import { occurrenceKey, parseItemKey, selectedIn } from "./item-key";

const ID = "6f9619ff-8b86-4011-b42d-00c04fc964ff" as ItemId;

describe("selectedIn", () => {
  const SERIES = "6f9619ff-8b86-4011-b42d-00c04fc96400" as ItemId;
  const override = makeItem({ recurrence: { kind: "override", seriesId: SERIES, originalOn: "2026-10-07" as LocalDate } });
  const plain = makeItem();

  it("finds an item by its id, and an override by the occurrence key it replaced", () => {
    expect(selectedIn([plain, override], plain.id)).toBe(plain.id);
    expect(selectedIn([plain, override], `${SERIES}~2026-10-07`)).toBe(override.id);
  });

  it("passes anything else through", () => {
    expect(selectedIn([plain, override], `${SERIES}~2026-10-08`)).toBe(`${SERIES}~2026-10-08`);
    expect(selectedIn([plain], null)).toBeNull();
  });
});

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
