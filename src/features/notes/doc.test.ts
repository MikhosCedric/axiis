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
  it("keeps a numbered list's start and a link's href, as tiptap writes them", () => {
    const body = doc(
      { type: "orderedList", attrs: { start: 3, type: null }, content: [{ type: "listItem", content: [para(text("c"))] }] },
      para(text("site", [{ type: "link", attrs: { href: "https://example.com/", target: null, rel: "noopener", class: null } }])),
    );
    const parsed = parseBody(JSON.parse(JSON.stringify(body)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.doc.content?.[0].attrs).toEqual({ start: 3, type: null });
      expect(parsed.doc.content?.[1].content?.[0].marks).toEqual([{ type: "link", attrs: { href: "https://example.com/" } }]);
    }
  });

  it("keeps a checklist, with each box's state, and reads its lines as text", () => {
    const list = {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [para(text("Pack the bulbs"))] },
        { type: "taskItem", attrs: { checked: false }, content: [para(text("Buy twine"))] },
      ],
    };
    const parsed = parseBody(doc(list));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.doc.content?.[0]).toEqual(list);
      expect(parsed.text).toBe("Pack the bulbs\nBuy twine");
    }
  });

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
