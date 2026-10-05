import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/today", "/today"],
    ["/items/abc?view=list#notes", "/items/abc?view=list#notes"],
    ["/a/../b", "/b"],
  ])("keeps the same-origin path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "today",
    "https://evil.com",
    "//evil.com",
    "//evil.com/today",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "javascript:alert(1)",
    " /today",
  ])("falls back to / for %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});
