import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "./item";
import { occurrenceKey } from "./item-key";
import { byName, parseTagName, sameTag, tagOwner, TAG_NAME_MAX } from "./tag";

const SERIES = "00000000-0000-4000-8000-00000000000a" as ItemId;
const OVERRIDE = "00000000-0000-4000-8000-00000000000b" as ItemId;
const on = "2026-10-06" as LocalDate;

describe("parseTagName", () => {
  it("keeps the case it was typed in, trims, collapses spaces and drops a leading #", () => {
    expect(parseTagName("  Deep \t  work ")).toBe("Deep work");
    expect(parseTagName("#errands")).toBe("errands");
    expect(parseTagName("## Home")).toBe("Home");
    expect(parseTagName("c#")).toBe("c#");
  });

  it("takes 1 to 32 characters", () => {
    expect(parseTagName("x".repeat(TAG_NAME_MAX))).toBe("x".repeat(TAG_NAME_MAX));
    expect(parseTagName("x".repeat(TAG_NAME_MAX + 1))).toBeNull();
    expect(parseTagName("   ")).toBeNull();
    expect(parseTagName("#")).toBeNull();
  });

  it("refuses anything that is not text, and control characters", () => {
    expect(parseTagName(undefined)).toBeNull();
    expect(parseTagName(12)).toBeNull();
    expect(parseTagName("bell\u0007")).toBeNull();
  });
});

describe("comparing and ordering", () => {
  it("treats names that differ only in case as the same tag", () => {
    expect(sameTag("Deep", "deep")).toBe(true);
    expect(sameTag("deep", "deeper")).toBe(false);
  });

  it("orders by name without case", () => {
    expect(byName([{ name: "beta" }, { name: "Alpha" }, { name: "Gamma" }, { name: "able" }]).map((t) => t.name)).toEqual([
      "able",
      "Alpha",
      "beta",
      "Gamma",
    ]);
  });
});

describe("tagOwner", () => {
  const live = new Set([SERIES]);

  it("gives an occurrence and an override of a live series the series' tags", () => {
    expect(tagOwner({ id: occurrenceKey(SERIES, on), recurrence: { kind: "occurrence", seriesId: SERIES, originalOn: on } }, live)).toBe(SERIES);
    expect(tagOwner({ id: OVERRIDE, recurrence: { kind: "override", seriesId: SERIES, originalOn: on } }, live)).toBe(SERIES);
  });

  it("gives an override whose series is gone its own, like any ordinary item", () => {
    expect(tagOwner({ id: OVERRIDE, recurrence: { kind: "override", seriesId: SERIES, originalOn: on } }, new Set())).toBe(OVERRIDE);
    expect(tagOwner({ id: SERIES, recurrence: { kind: "none" } }, live)).toBe(SERIES);
  });
});
