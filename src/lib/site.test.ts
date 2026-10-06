import { describe, expect, it } from "vitest";
import { parseSiteUrl } from "./site";

describe("parseSiteUrl", () => {
  it.each([undefined, "", "   "])("falls back to the local dev origin for %j", (raw) => {
    expect(parseSiteUrl(raw).href).toBe("http://localhost:3000/");
  });

  it("keeps only the origin of a configured URL", () => {
    expect(parseSiteUrl("https://axiis.example/some/path?q=1").href).toBe("https://axiis.example/");
  });

  it.each(["axiis.example", "javascript:alert(1)", "ftp://axiis.example"])("refuses %s", (raw) => {
    expect(() => parseSiteUrl(raw)).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
