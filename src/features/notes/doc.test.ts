import { describe, expect, it } from "vitest";
import { BODY_MAX_BYTES, bodyText, parseBody, type DocNode } from "./doc";

const text = (t: string, marks?: DocNode["marks"]): DocNode => ({ type: "text", text: t, ...(marks && { marks }) });
const para = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });
const link = (href: string) => [{ type: "link", attrs: { href, target: "_blank", rel: null, onclick: "x" } }];

describe("bodyText", () => {
  it("puts blocks on their own lines and runs inline text together", () => {
    const d = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Garden")] },
      para(text("Plant "), text("tulips", [{ type: "bold" }]), text(" soon.")),
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [para(text("Bulbs"))] },
          {
            type: "listItem",
            content: [
              para(text("Tools")),
              { type: "orderedList", content: [{ type: "listItem", content: [para(text("Trowel"))] }] },
            ],
          },
        ],
      },
      { type: "blockquote", content: [para(text("Patience"))] },
      { type: "codeBlock", content: [text("water(daily)")] },
    );
    expect(bodyText(d)).toBe("Garden\nPlant tulips soon.\nBulbs\nTools\nTrowel\nPatience\nwater(daily)");
  });

  it("turns a hard break into a new line and skips empty paragraphs", () => {
    expect(bodyText(doc(para(text("one"), { type: "hardBreak" }, text("two")), para(), para(text("three"))))).toBe(
      "one\ntwo\nthree",
    );
  });

  it("is empty for an empty or missing document", () => {
    expect(bodyText(doc(para()))).toBe("");
    expect(bodyText(null)).toBe("");
  });
});

describe("parseBody", () => {
  it("accepts a document and returns its text", () => {
    expect(parseBody(doc(para(text("hello"))))).toEqual({ ok: true, doc: doc(para(text("hello"))), text: "hello" });
  });

  it("drops unsafe link marks and keeps only the href of safe ones", () => {
    const result = parseBody(doc(para(text("bad", link("javascript:alert(1)")), text("good", link("https://example.com")))));
    expect(result.ok && result.doc).toEqual(
      doc(para(text("bad", []), text("good", [{ type: "link", attrs: { href: "https://example.com/" } }]))),
    );
  });

  it("refuses nodes and marks the editor does not make", () => {
    expect(parseBody(doc({ type: "iframe", attrs: { src: "https://x" } }))).toEqual({ ok: false, reason: "malformed" });
    expect(parseBody(doc(para(text("x", [{ type: "script" }]))))).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses anything that is not a document", () => {
    expect(parseBody(para(text("x")))).toEqual({ ok: false, reason: "malformed" });
    expect(parseBody("<p>hi</p>")).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses a body over the size cap and accepts one just under", () => {
    const sized = (n: number) => doc(para(text("a".repeat(n))));
    const overhead = JSON.stringify(sized(0)).length;
    expect(parseBody(sized(BODY_MAX_BYTES - overhead)).ok).toBe(true);
    expect(parseBody(sized(BODY_MAX_BYTES - overhead + 1))).toEqual({ ok: false, reason: "too-large" });
  });
});
