import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ItemId } from "@/domain/item";
import type { TagId, TagName } from "@/domain/tag";
import { SupabaseItemsRepo } from "./supabase-repo";

const ITEM = "00000000-0000-4000-8000-00000000000a" as ItemId;
const OTHER = "00000000-0000-4000-8000-00000000000b" as ItemId;
const DEEP = "00000000-0000-4000-b000-000000000001" as TagId;
const HOME = "00000000-0000-4000-b000-000000000002" as TagId;
const name = (s: string) => s as TagName;

type Request = { method: string; table: string; params: URLSearchParams; body: unknown };
type Reply = { status?: number; body: unknown };

/** A repo whose PostgREST requests are recorded and answered by `answer`. */
function stubbed(answer: (r: Request, nth: number) => Reply = () => ({ body: [] })) {
  const requests: Request[] = [];
  const db = createClient("http://db.test", "anon", {
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const request = {
          method: init?.method ?? "GET",
          table: url.pathname.split("/").at(-1)!,
          params: url.searchParams,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        };
        requests.push(request);
        const reply = answer(request, requests.filter((r) => r.table === request.table && r.method === request.method).length);
        return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  return { repo: new SupabaseItemsRepo(db), requests };
}

describe("SupabaseItemsRepo tags", () => {
  it("counts only open, live items per tag, reading every page until one comes back empty", async () => {
    const page = (n: number, tag: string) => Array.from({ length: n }, () => ({ tag_id: tag, items: { id: ITEM } }));
    const { repo, requests } = stubbed((r, nth) => {
      if (r.table === "tags") return { body: [{ id: DEEP, name: "Deep" }, { id: HOME, name: "home" }] };
      return { body: nth === 1 ? page(1000, DEEP) : nth === 2 ? [...page(3, DEEP), ...page(2, HOME)] : [] };
    });

    expect(await repo.listTags()).toEqual([
      { id: DEEP, name: "Deep", open: 1003 },
      { id: HOME, name: "home", open: 2 },
    ]);

    const counts = requests.filter((r) => r.table === "item_tags");
    expect(counts).toHaveLength(3);
    expect(counts[0].params.get("select")).toBe("tag_id,items!inner(id)");
    expect(counts[0].params.get("items.status")).toBe("eq.open");
    expect(counts[0].params.get("items.deleted_at")).toBe("is.null");
    expect(counts.map((r) => [r.params.get("offset"), r.params.get("limit")])).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
      ["1005", "1000"],
    ]);
  });

  it("reads the tags of many items in one request, keyed by item", async () => {
    const { repo, requests } = stubbed(() => ({
      body: [
        { item_id: ITEM, tags: { id: DEEP, name: "Deep" } },
        { item_id: ITEM, tags: { id: HOME, name: "home" } },
        { item_id: OTHER, tags: { id: HOME, name: "home" } },
      ],
    }));

    expect(await repo.tagsForItems([ITEM, OTHER])).toEqual({
      [ITEM]: [
        { id: DEEP, name: "Deep" },
        { id: HOME, name: "home" },
      ],
      [OTHER]: [{ id: HOME, name: "home" }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].params.get("item_id")).toBe(`in.(${ITEM},${OTHER})`);
    expect(await repo.tagsForItems([])).toEqual({});
    expect(requests).toHaveLength(1);
  });

  it("lists live items with a tag, open before done, dropped left out, newest first, at most 200", async () => {
    const { repo, requests } = stubbed();
    await repo.listTagged(DEEP);
    const q = requests[0].params;
    expect(q.get("item_tags.tag_id")).toBe(`eq.${DEEP}`);
    expect(q.get("select")).toMatch(/,item_tags!inner\(tag_id\)$/);
    expect(q.get("deleted_at")).toBe("is.null");
    expect(q.get("status")).toBe("neq.dropped");
    expect(q.get("order")).toBe("status.asc,created_at.desc");
    expect(q.get("limit")).toBe("200");
  });

  it("puts an existing tag on an item without making another, matching the name without case", async () => {
    const { repo, requests } = stubbed((r) => ({ body: r.table === "tags" ? [{ id: DEEP, name: "Deep" }] : null }));

    expect(await repo.addTag(ITEM, name("deep"))).toEqual({ id: DEEP, name: "Deep" });

    expect(requests.filter((r) => r.method === "POST" && r.table === "tags")).toEqual([]);
    const link = requests.find((r) => r.table === "item_tags")!;
    expect(link.method).toBe("POST");
    expect(link.body).toEqual({ item_id: ITEM, tag_id: DEEP });
    expect(link.params.get("on_conflict")).toBe("item_id,tag_id");
  });

  it("makes a missing tag, and uses the other one when a request at the same moment made it first", async () => {
    const made = stubbed((r) => ({ body: r.table === "tags" && r.method === "POST" ? { id: HOME, name: "Home" } : r.table === "tags" ? [] : null }));
    expect(await made.repo.addTag(ITEM, name("Home"))).toEqual({ id: HOME, name: "Home" });
    expect(made.requests.find((r) => r.method === "POST" && r.table === "tags")!.body).toEqual({ name: "Home" });

    const raced = stubbed((r, nth) => {
      if (r.table === "tags" && r.method === "POST") return { status: 409, body: { code: "23505", message: "duplicate key" } };
      if (r.table === "tags") return { body: nth === 1 ? [] : [{ id: HOME, name: "home" }] };
      return { body: null };
    });
    expect(await raced.repo.addTag(ITEM, name("Home"))).toEqual({ id: HOME, name: "home" });
    expect(raced.requests.find((r) => r.table === "item_tags")!.body).toEqual({ item_id: ITEM, tag_id: HOME });
  });

  it("takes a tag off one item, and deletes a tag by id alone", async () => {
    const { repo, requests } = stubbed(() => ({ body: null }));
    await repo.removeTag(ITEM, DEEP);
    await repo.deleteTag(HOME);
    expect(requests.map((r) => [r.method, r.table, r.params.get("item_id"), r.params.get("tag_id"), r.params.get("id")])).toEqual([
      ["DELETE", "item_tags", `eq.${ITEM}`, `eq.${DEEP}`, null],
      ["DELETE", "tags", null, null, `eq.${HOME}`],
    ]);
  });
});
