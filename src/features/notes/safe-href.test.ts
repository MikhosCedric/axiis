import { describe, expect, it } from "vitest";
import { safeHref } from "./safe-href";

describe("safeHref", () => {
  it.each([
    ["https://example.com/a?b=1#c", "https://example.com/a?b=1#c"],
    ["http://example.com", "http://example.com/"],
    ["  https://example.com  ", "https://example.com/"],
    ["mailto:me@example.com", "mailto:me@example.com"],
    ["example.com/path", "https://example.com/path"],
    ["sub.example.co.uk", "https://sub.example.co.uk/"],
  ])("allows %s", (raw, href) => {
    expect(safeHref(raw)).toBe(href);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "javascript://example.com/%0Aalert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "//example.com",
    "/relative/path",
    "https://",
    "not a link",
    "",
  ])("refuses %s", (raw) => {
    expect(safeHref(raw)).toBeNull();
  });
});
