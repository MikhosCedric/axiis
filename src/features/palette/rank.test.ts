import { describe, expect, it } from "vitest";
import { matchTier, rank } from "./rank";

describe("matchTier", () => {
  it("puts a prefix first, then a substring, then a subsequence", () => {
    expect(matchTier("set", "Settings")).toBe(0);
    expect(matchTier("tin", "Settings")).toBe(1);
    expect(matchTier("stg", "Settings")).toBe(2);
    expect(matchTier("gst", "Settings")).toBeNull();
  });

  it("ignores case and extra spaces", () => {
    expect(matchTier("  WEEK ", "Week")).toBe(0);
    expect(matchTier("key  short", "Keyboard shortcuts")).toBe(2);
    expect(matchTier("board sh", "Keyboard shortcuts")).toBe(1);
  });

  it("matches everything when the query is empty", () => {
    expect(matchTier("", "Notes")).toBe(0);
  });

  it("does not match a query longer than the text", () => {
    expect(matchTier("notesy", "Notes")).toBeNull();
  });
});

describe("rank", () => {
  const texts = (s: { label: string; keys: string[] }) => [s.label, ...s.keys];

  it("orders by tier and drops what does not match", () => {
    const entries = [
      { label: "Today", keys: [] },
      { label: "Notes", keys: [] },
      { label: "Settings", keys: ["account"] },
      { label: "Week", keys: [] },
    ];
    expect(rank(entries, "t", texts).map((e) => e.label)).toEqual(["Today", "Notes", "Settings"]);
    expect(rank(entries, "es", texts).map((e) => e.label)).toEqual(["Notes", "Settings"]);
    expect(rank(entries, "wk", texts).map((e) => e.label)).toEqual(["Week"]);
  });

  it("uses the best tier among an entry's texts", () => {
    const entries = [
      { label: "Search", keys: ["find"] },
      { label: "Infinite", keys: [] },
    ];
    expect(rank(entries, "fin", texts).map((e) => e.label)).toEqual(["Search", "Infinite"]);
  });

  it("keeps the given order inside a tier", () => {
    const entries = ["Banana", "Apple", "Avocado", "Apricot"].map((label) => ({ label, keys: [] }));
    expect(rank(entries, "a", texts).map((e) => e.label)).toEqual(["Apple", "Avocado", "Apricot", "Banana"]);
  });
});
