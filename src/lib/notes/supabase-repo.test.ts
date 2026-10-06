import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ItemId } from "@/domain/item";
import { SupabaseNotesRepo } from "./supabase-repo";

const A = "00000000-0000-4000-8000-00000000000a" as ItemId;
const B = "00000000-0000-4000-8000-00000000000b" as ItemId;
const C = "00000000-0000-4000-8000-00000000000c" as ItemId;
const T = "2026-10-06T08:00:00+00:00";

const itemRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: "note",
  title: "t",
  body: null,
  status: "open",
  area_id: null,
  parent_id: null,
  position: 0,
  start_at: null,
  end_at: null,
  scheduled_on: null,
  due_on: null,
  rrule: null,
  series_id: null,
  original_on: null,
  completed_at: null,
  created_at: T,
  updated_at: T,
  ...over,
});

/** A repo whose PostgREST requests are recorded and answered from `replies` in order. */
function stubbed(replies: unknown[]) {
  const requests: { method: string; url: URL; body: unknown }[] = [];
  const db = createClient("http://db.test", "anon", {
    global: {
      fetch: async (input, init) => {
        requests.push({
          method: init?.method ?? "GET",
          url: new URL(String(input)),
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        return new Response(JSON.stringify(replies.shift() ?? []), { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  return { repo: new SupabaseNotesRepo(db), requests };
}

describe("SupabaseNotesRepo.search", () => {
  it("asks for a websearch match, live rows, newest first, at most 30", async () => {
    const { repo, requests } = stubbed([[itemRow(A, { body_text: "plant tulips before frost" })]]);
    const hits = await repo.search('tulips "before frost"');
    const q = requests[0].url.searchParams;
    expect(q.get("search")).toBe('wfts(simple).tulips "before frost"');
    expect(q.get("deleted_at")).toBe("is.null");
    expect(q.get("order")).toBe("updated_at.desc");
    expect(q.get("limit")).toBe("30");
    expect(q.get("type")).toBeNull();
    expect(hits).toEqual([expect.objectContaining({ snippet: "plant tulips before frost" })]);
    expect(hits[0].item.id).toBe(A);
  });

  it("narrows to one type when asked", async () => {
    const { repo, requests } = stubbed([[]]);
    await repo.search("x", { type: "note" });
    expect(requests[0].url.searchParams.get("type")).toBe("eq.note");
  });
});

describe("SupabaseNotesRepo.linksFor", () => {
  it("reads links in both directions and drops ends that are deleted", async () => {
    const { repo, requests } = stubbed([
      [
        { id: "10000000-0000-4000-8000-000000000001", from_id: A, to_id: B },
        { id: "10000000-0000-4000-8000-000000000002", from_id: C, to_id: A },
        { id: "10000000-0000-4000-8000-000000000003", from_id: A, to_id: "00000000-0000-4000-8000-0000000000dd" },
      ],
      [itemRow(B, { type: "task" }), itemRow(C)],
    ]);
    const linked = await repo.linksFor(A);
    expect(requests[0].url.searchParams.get("or")).toBe(`(from_id.eq.${A},to_id.eq.${A})`);
    expect(requests[1].url.searchParams.get("deleted_at")).toBe("is.null");
    expect(linked.map((l) => [l.item.id, l.direction])).toEqual([
      [B, "outgoing"],
      [C, "incoming"],
    ]);
  });
});

describe("SupabaseNotesRepo writes", () => {
  it("links with an insert that ignores an existing identical link", async () => {
    const { repo, requests } = stubbed([null]);
    await repo.link(A, B);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.searchParams.get("on_conflict")).toBe("from_id,to_id,kind");
    expect(requests[0].body).toEqual({ from_id: A, to_id: B });
  });

  it("saves only a live note", async () => {
    const { repo, requests } = stubbed([itemRow(A, { body_text: "hi" })]);
    await repo.saveNote(A, { title: "T", body: { type: "doc" }, bodyText: "hi" });
    const q = requests[0].url.searchParams;
    expect(requests[0].method).toBe("PATCH");
    expect([q.get("id"), q.get("type"), q.get("deleted_at")]).toEqual([`eq.${A}`, "eq.note", "is.null"]);
    expect(requests[0].body).toEqual({ title: "T", body: { type: "doc" }, body_text: "hi" });
  });
});
