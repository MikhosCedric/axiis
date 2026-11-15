import { describe, expect, it } from "vitest";
import { plainLine, readPrefill, sharedCapture } from "./capture-prefill";
import { TITLE_MAX } from "./model";

describe("plainLine", () => {
  it("makes one line of plain text", () => {
    expect(plainLine("  a\n\tb\u0000c ‮ d  ", 100)).toBe("a b c d");
  });

  it("cuts by characters without splitting an emoji", () => {
    expect(plainLine("😀😀😀", 2)).toBe("😀😀");
  });
});

describe("sharedCapture", () => {
  it("joins title, text and link on one line", () => {
    expect(sharedCapture({ title: "Tea", text: "buy some", url: "https://example.com/a?b=1" })).toBe("Tea buy some https://example.com/a?b=1");
  });

  it("does not say a link twice when the text already holds it", () => {
    expect(sharedCapture({ text: "Read https://example.com/a", url: "https://example.com/a" })).toBe("Read https://example.com/a");
  });

  it("drops a link that is not http or https, and one that is not a link", () => {
    expect(sharedCapture({ title: "x", url: "javascript:alert(1)" })).toBe("x");
    expect(sharedCapture({ title: "x", url: "not a url" })).toBe("x");
    expect(sharedCapture({ title: "x", url: "file:///etc/passwd" })).toBe("x");
  });

  it("keeps markup as plain characters and stays inside the title limit", () => {
    expect(sharedCapture({ title: "<img src=x onerror=alert(1)>" })).toBe("<img src=x onerror=alert(1)>");
    const long = sharedCapture({ title: "a".repeat(5000), text: "b".repeat(5000), url: "https://example.com/" + "c".repeat(5000) });
    expect(Array.from(long).length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("takes the first of a repeated parameter and nothing from an empty share", () => {
    expect(sharedCapture({ title: ["one", "two"] })).toBe("one");
    expect(sharedCapture({})).toBe("");
  });
});

describe("readPrefill", () => {
  it("is null when the address has none, and checks what it has", () => {
    expect(readPrefill(undefined)).toBeNull();
    expect(readPrefill("")).toBe("");
    expect(readPrefill("a\nb")).toBe("a b");
    expect(Array.from(readPrefill("z".repeat(TITLE_MAX + 50))!)).toHaveLength(TITLE_MAX);
  });
});
