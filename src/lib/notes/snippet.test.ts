import { describe, expect, it } from "vitest";
import { queryTerms, snippetFor } from "./snippet";

const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("queryTerms", () => {
  it("keeps the words a websearch query looks for", () => {
    expect(queryTerms('"Plant tulips" or bulbs -frost')).toEqual(["plant", "tulips", "bulbs"]);
  });
});

describe("snippetFor", () => {
  it("returns short text whole, with lines joined and spaces collapsed", () => {
    expect(snippetFor("Plant\n\ntulips   soon", "tulips")).toBe("Plant · tulips soon");
  });

  it("centres on the first matching word deep in a long text", () => {
    const text = `${filler(80)} the ferry to Cacilhas leaves at nine ${filler(80)}`;
    const s = snippetFor(text, "cacilhas", 120);
    expect(s).toContain("Cacilhas");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(122);
  });

  it("matches without regard to case and picks the earliest of several words", () => {
    const text = `${filler(60)} ALPHA ${filler(60)} beta ${filler(60)}`;
    const s = snippetFor(text, "beta alpha", 100);
    expect(s).toContain("ALPHA");
    expect(s).not.toContain("beta");
  });

  it("starts at the beginning when no word appears in the text", () => {
    const s = snippetFor(filler(100), "nothing", 50);
    expect(s.startsWith("word0 ")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
  });

  it("does not cut a word in half", () => {
    const s = snippetFor(filler(100), "word50", 60);
    const inner = s.replace(/^…|…$/g, "");
    expect(inner.split(" ").every((w) => /^word\d+$/.test(w))).toBe(true);
  });
});
