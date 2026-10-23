import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ItemId } from "@/domain/item";
import type { TagId, TagName } from "@/domain/tag";
import { SupabaseItemsRepo } from "./supabase-repo";

const ITEM = "00000000-0000-4000-8000-00000000000a" as ItemId;
const OTHER = "00000000-0000-4000-8000-00000000000b" as ItemId;
const DEEP = "00000000-0000-4000-b000-000000000001" as TagId;
const HOME = "00000000-0000-4000-b000-000000000002" as TagId;
const UNUSED = "00000000-0000-4000-b000-000000000003" as TagId;
const name = (s: string) => s as TagName;

type Request = { method: string; table: string; params: URLSearchParams; body: unknown };
type Reply = { status?: number; body: unknown; headers?: Record<string, string> };

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
        return new Response(JSON.stringify(reply.body), {
          status: reply.status ?? 200,
          headers: { "content-type": "application/json", ...reply.headers },
        });
      },
    },
  });
  return { repo: new SupabaseItemsRepo(db), requests };
}

describe("SupabaseItemsRepo tags", () => {
  it("reads each tag's open count from one tag_open_counts call, however many items carry it", async () => {
    const { repo, requests } = stubbed((r) => {
      if (r.table === "tags") return { body: [{ id: DEEP, name: "Deep", color: null }, { id: HOME, name: "home", color: null }, { id: UNUSED, name: "unused", color: null }] };
      return { body: [{ tag_id: DEEP, open: 1003 }, { tag_id: HOME, open: 2 }] };
    });

    expect(await repo.listTags()).toEqual([
      { id: DEEP, name: "Deep", color: null, open: 1003 },
      { id: HOME, name: "home", color: null, open: 2 },
      { id: UNUSED, name: "unused", color: null, open: 0 },
    ]);
    expect(requests.map((r) => [r.method, r.table])).toEqual(
      expect.arrayContaining([
        ["GET", "tags"],
        ["POST", "tag_open_counts"],
      ]),
    );
    expect(requests).toHaveLength(2);
    expect(requests.some((r) => r.table === "item_tags")).toBe(false);
  });

  it("reads the tags of many items in one request, keyed by item", async () => {
    const { repo, requests } = stubbed(() => ({
      body: [
        { item_id: ITEM, tags: { id: DEEP, name: "Deep", color: null } },
        { item_id: ITEM, tags: { id: HOME, name: "home", color: null } },
        { item_id: OTHER, tags: { id: HOME, name: "home", color: null } },
      ],
    }));

    expect(await repo.tagsForItems([ITEM, OTHER])).toEqual({
      [ITEM]: [
        { id: DEEP, name: "Deep", color: null },
        { id: HOME, name: "home", color: null },
      ],
      [OTHER]: [{ id: HOME, name: "home", color: null }],
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
    const { repo, requests } = stubbed((r) => ({ body: r.table === "tags" ? [{ id: DEEP, name: "Deep", color: null }] : null }));

    expect(await repo.addTags(ITEM, [name("deep")])).toEqual([{ id: DEEP, name: "Deep", color: null }]);

    expect(requests.filter((r) => r.method === "POST" && r.table === "tags")).toEqual([]);
    const link = requests.find((r) => r.table === "item_tags")!;
    expect(link.method).toBe("POST");
    expect(link.body).toEqual([{ item_id: ITEM, tag_id: DEEP }]);
    expect(link.params.get("on_conflict")).toBe("item_id,tag_id");
  });

  it("makes every missing tag in one insert and links them all in one more request", async () => {
    const { repo, requests } = stubbed((r) => ({
      body:
        r.table === "tags" && r.method === "POST"
          ? [
              { id: HOME, name: "Home", color: null },
              { id: DEEP, name: "Deep", color: null },
            ]
          : r.table === "tags"
            ? []
            : null,
    }));
    expect(await repo.addTags(ITEM, [name("Home"), name("home"), name("Deep")])).toEqual([
      { id: HOME, name: "Home", color: null },
      { id: DEEP, name: "Deep", color: null },
    ]);
    expect(requests.map((r) => [r.method, r.table])).toEqual([
      ["GET", "tags"],
      ["POST", "tags"],
      ["POST", "item_tags"],
    ]);
    expect(requests[1].body).toEqual([{ name: "Home" }, { name: "Deep" }]);
    expect(requests[2].body).toEqual([
      { item_id: ITEM, tag_id: HOME },
      { item_id: ITEM, tag_id: DEEP },
    ]);
  });

  it("uses the other tag when a request at the same moment made it first, and still makes the rest", async () => {
    const raced = stubbed((r, nth) => {
      if (r.table === "tags" && r.method === "POST") {
        return nth === 1 ? { status: 409, body: { code: "23505", message: "duplicate key" } } : { body: [{ id: DEEP, name: "Deep", color: null }] };
      }
      if (r.table === "tags") return { body: nth === 1 ? [] : [{ id: HOME, name: "home", color: null }] };
      return { body: null };
    });
    expect(await raced.repo.addTags(ITEM, [name("Home"), name("Deep")])).toEqual([
      { id: HOME, name: "home", color: null },
      { id: DEEP, name: "Deep", color: null },
    ]);
    const inserts = raced.requests.filter((r) => r.method === "POST" && r.table === "tags");
    expect(inserts.map((r) => r.body)).toEqual([[{ name: "Home" }, { name: "Deep" }], [{ name: "Deep" }]]);
    expect(raced.requests.find((r) => r.table === "item_tags")!.body).toEqual([
      { item_id: ITEM, tag_id: HOME },
      { item_id: ITEM, tag_id: DEEP },
    ]);
  });

  it("renames one tag by id and reads back what was stored", async () => {
    const { repo, requests } = stubbed(() => ({ body: { id: DEEP, name: "Focus", color: null } }));
    expect(await repo.renameTag(DEEP, name("Focus"))).toEqual({ id: DEEP, name: "Focus", color: null });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "PATCH", table: "tags", body: { name: "Focus" } });
    expect(requests[0].params.get("id")).toBe(`eq.${DEEP}`);
  });

  it("sets and clears one tag's colour by id, and refuses a colour the palette lacks on the way back", async () => {
    const { repo, requests } = stubbed((r) => ({ body: { id: DEEP, name: "Deep", color: (r.body as { color: string | null }).color } }));
    expect(await repo.setTagColor(DEEP, "indigo")).toEqual({ id: DEEP, name: "Deep", color: "indigo" });
    expect(await repo.setTagColor(DEEP, null)).toEqual({ id: DEEP, name: "Deep", color: null });
    expect(requests.map((r) => [r.method, r.table, r.body, r.params.get("id"), r.params.get("select")])).toEqual([
      ["PATCH", "tags", { color: "indigo" }, `eq.${DEEP}`, "id,name,color"],
      ["PATCH", "tags", { color: null }, `eq.${DEEP}`, "id,name,color"],
    ]);
    const odd = stubbed(() => ({ body: { id: DEEP, name: "Deep", color: "teal" } }));
    await expect(odd.repo.setTagColor(DEEP, "moss")).rejects.toThrow();
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
