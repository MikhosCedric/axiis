import { z } from "zod";
import { safeHref } from "./safe-href";

/** Tiptap's JSON document shape, limited to the nodes and marks the note editor makes. */
export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; marks?: DocMark[]; text?: string };

export const NODE_TYPES = [
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
] as const;
export const MARK_TYPES = ["bold", "italic", "code", "link", "strike", "underline"] as const;

/** The most a note's body may weigh, as serialized JSON. */
export const BODY_MAX_BYTES = 200 * 1024;
export const NOTE_TITLE_MAX = 500;

const attrs = z.record(z.string(), z.unknown()).optional();
const mark = z.object({ type: z.enum(MARK_TYPES), attrs });
const node: z.ZodType<DocNode> = z.object({
  type: z.enum(NODE_TYPES),
  attrs,
  text: z.string().optional(),
  marks: z.array(mark).optional(),
  get content() {
    return z.array(node).optional();
  },
});

const BLOCK_SEPARATOR = "\n";

/** The plain text of a document: blocks on their own lines, inline text run together. */
export function bodyText(doc: DocNode | null): string {
  if (!doc) return "";
  const walk = (n: DocNode): string => {
    if (n.type === "text") return n.text ?? "";
    if (n.type === "hardBreak") return "\n";
    const children = n.content ?? [];
    const inline = children.every((c) => c.type === "text" || c.type === "hardBreak");
    return children.map(walk).join(inline ? "" : BLOCK_SEPARATOR);
  };
  return walk(doc)
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Drops link marks whose href is not http, https or mailto, and keeps only the href of the rest. */
function cleanLinks(n: DocNode): DocNode {
  const marks = n.marks?.flatMap((m): DocMark[] => {
    if (m.type !== "link") return [m];
    const href = typeof m.attrs?.href === "string" ? safeHref(m.attrs.href) : null;
    return href ? [{ type: "link", attrs: { href } }] : [];
  });
  return {
    ...n,
    ...(marks && { marks }),
    ...(n.content && { content: n.content.map(cleanLinks) }),
  };
}

export type ParsedBody = { ok: true; doc: DocNode; text: string } | { ok: false; reason: "too-large" | "malformed" };

/** Parses a body sent by the client: size first, then shape, then links. */
export function parseBody(raw: unknown): ParsedBody {
  const serialized = JSON.stringify(raw ?? null);
  if (new TextEncoder().encode(serialized).length > BODY_MAX_BYTES) return { ok: false, reason: "too-large" };
  const parsed = node.safeParse(raw);
  if (!parsed.success || parsed.data.type !== "doc") return { ok: false, reason: "malformed" };
  const doc = cleanLinks(parsed.data);
  return { ok: true, doc, text: bodyText(doc) };
}
