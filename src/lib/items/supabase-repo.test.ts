import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate } from "@/domain/item";
import { SupabaseItemsRepo } from "./supabase-repo";

const SERIES = "00000000-0000-4000-8000-00000000000a" as ItemId;
const d = (s: string) => s as LocalDate;

/** A repo whose PostgREST requests are recorded and answered with no rows. */
function stubbed() {
  const requests: URLSearchParams[] = [];
  const db = createClient("http://db.test", "anon", {
    global: {
      fetch: async (input) => {
        requests.push(new URL(String(input)).searchParams);
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  return { repo: new SupabaseItemsRepo(db), requests };
}

describe("SupabaseItemsRepo and series", () => {
  it("leaves series out of the day and range reads, which expand them instead", async () => {
    const { repo, requests } = stubbed();
    await repo.listForDay({ date: d("2026-10-06"), from: new Date("2026-10-06T00:00:00Z"), to: new Date("2026-10-07T00:00:00Z") });
    await repo.listRange({ from: new Date(0), to: new Date(1), fromDate: d("2026-10-05"), toDate: d("2026-10-12") });
    // Day: timed, day-only, unscheduled. Range: one read for both. A series always has a schedule.
    expect(requests.map((q) => q.get("rrule"))).toEqual(["is.null", "is.null", null, "is.null"]);
  });

  it("reads live series, oldest first, at most 200", async () => {
    const { repo, requests } = stubbed();
    await repo.listSeries();
    expect(requests[0].get("rrule")).toBe("not.is.null");
    expect(requests[0].get("deleted_at")).toBe("is.null");
    expect(requests[0].get("order")).toBe("created_at.asc");
    expect(requests[0].get("limit")).toBe("200");
  });

  it("reads the inbox as open, unscheduled, top-level non-notes outside any series, newest first, at most 200", async () => {
    const { repo, requests } = stubbed();
    await repo.listInbox();
    const q = requests[0];
    expect(Object.fromEntries(["deleted_at", "rrule", "start_at", "scheduled_on", "parent_id", "series_id"].map((k) => [k, q.get(k)]))).toEqual({
      deleted_at: "is.null",
      rrule: "is.null",
      start_at: "is.null",
      scheduled_on: "is.null",
      parent_id: "is.null",
      series_id: "is.null",
    });
    expect(q.get("status")).toBe("eq.open");
    expect(q.get("type")).toBe("neq.note");
    expect(q.get("order")).toBe("created_at.desc");
    expect(q.get("limit")).toBe("200");
  });

  it("reads live top-level checklists outside any override, dropped ones left out, open first then newest, at most 200", async () => {
    const { repo, requests } = stubbed();
    await repo.listChecklists();
    const q = requests[0];
    expect(Object.fromEntries(["type", "deleted_at", "parent_id", "series_id", "status"].map((k) => [k, q.get(k)]))).toEqual({
      type: "eq.checklist",
      deleted_at: "is.null",
      parent_id: "is.null",
      series_id: "is.null",
      status: "neq.dropped",
    });
    // Series are kept (each shows once), and a schedule does not matter.
    expect([q.get("rrule"), q.get("start_at"), q.get("scheduled_on")]).toEqual([null, null, null]);
    expect(q.get("order")).toBe("status.asc,created_at.desc");
    expect(q.get("limit")).toBe("200");
  });

  it("reads live overrides by the date they replace, of one series when asked", async () => {
    const { repo, requests } = stubbed();
    await repo.listOverrides(d("2026-10-05"), d("2026-10-12"));
    await repo.listOverrides(d("2026-10-05"), d("2026-10-06"), SERIES);
    expect(requests[0].get("series_id")).toBe("not.is.null");
    expect(requests[0].getAll("original_on")).toEqual(["gte.2026-10-05", "lt.2026-10-12"]);
    expect(requests[0].get("deleted_at")).toBe("is.null");
    expect(requests[0].get("status")).toBeNull();
    expect(requests[1].getAll("series_id")).toEqual(["not.is.null", `eq.${SERIES}`]);
  });
});

describe("SupabaseItemsRepo.listDue", () => {
  it("reads dated, live, top-level tasks and checklists that are open or done since the cut, soonest first", async () => {
    const { repo, requests } = stubbed();
    await repo.listDue(new Date("2026-10-07T10:00:00Z"));
    const q = requests[0];
    expect(q.get("due_on")).toBe("not.is.null");
    expect(q.get("deleted_at")).toBe("is.null");
    expect(q.get("rrule")).toBe("is.null");
    expect(q.get("series_id")).toBe("is.null");
    expect(q.get("parent_id")).toBe("is.null");
    expect(q.get("type")).toBe("neq.note");
    expect(q.get("or")).toBe("(status.eq.open,and(status.eq.done,completed_at.gte.2026-10-07T10:00:00.000Z))");
    expect(q.get("order")).toBe("due_on.asc,created_at.asc");
    expect(q.get("limit")).toBe("200");
  });
});

describe("SupabaseItemsRepo.listBehind", () => {
  it("reads open one-off tasks planned before the day, timed and day-only, oldest first", async () => {
    const { repo, requests } = stubbed();
    await repo.listBehind({ date: d("2026-10-08"), from: new Date("2026-10-08T00:00:00Z"), to: new Date("2026-10-09T00:00:00Z") });
    const [timed, dayOnly] = requests;
    for (const q of [timed, dayOnly]) {
      expect(q.get("status")).toBe("eq.open");
      expect(q.get("deleted_at")).toBe("is.null");
      expect(q.get("rrule")).toBe("is.null");
      expect(q.get("series_id")).toBe("is.null");
      expect(q.get("parent_id")).toBe("is.null");
      expect(q.get("type")).toBe("neq.note");
      expect(q.get("limit")).toBe("50");
    }
    expect(timed.get("start_at")).toBe("lt.2026-10-08T00:00:00.000Z");
    expect(timed.get("order")).toBe("start_at.asc");
    expect(dayOnly.get("scheduled_on")).toBe("lt.2026-10-08");
    expect(dayOnly.get("order")).toBe("scheduled_on.asc");
  });
});

describe("SupabaseItemsRepo columns", () => {
  const selects = (requests: URLSearchParams[]) => requests.map((q) => q.get("select") ?? "");

  it("leaves the body out of every list read, and keeps it for one item and for series", async () => {
    const { repo, requests } = stubbed();
    const day = { date: d("2026-10-06"), from: new Date(0), to: new Date(1) };
    await repo.listForDay(day);
    await repo.listRange({ from: new Date(0), to: new Date(1), fromDate: d("2026-10-05"), toDate: d("2026-10-12") });
    await repo.listInbox();
    await repo.listChecklists();
    await repo.listOverrides(d("2026-10-05"), d("2026-10-12"));
    await repo.listChildren(SERIES);
    await repo.listDue(new Date(0));
    await repo.listBehind(day);
    for (const select of selects(requests)) expect(select.split(",")).not.toContain("body");

    requests.length = 0;
    await repo.get(SERIES);
    await repo.listSeries();
    for (const select of selects(requests)) expect(select.split(",")).toContain("body");
  });

  it("keeps notes out of the day's unscheduled read", async () => {
    const { repo, requests } = stubbed();
    await repo.listForDay({ date: d("2026-10-06"), from: new Date(0), to: new Date(1) });
    expect(requests[2].get("type")).toBe("neq.note");
  });
});

describe("SupabaseItemsRepo bounded reads", () => {
  it("reads the waiting items in the query: open, or done inside the day, newest first, at most 200", async () => {
    const { repo, requests } = stubbed();
    await repo.listForDay({ date: d("2026-10-06"), from: new Date("2026-10-05T22:00:00Z"), to: new Date("2026-10-06T22:00:00Z") });
    const q = requests[2];
    expect(q.get("or")).toBe(
      "(status.eq.open,and(status.eq.done,completed_at.gte.2026-10-05T22:00:00.000Z,completed_at.lt.2026-10-06T22:00:00.000Z))",
    );
    expect(q.get("order")).toBe("created_at.desc");
    expect(q.get("limit")).toBe("200");
  });

  it("reads several days in one request, timed or day-only, at most 500", async () => {
    const { repo, requests } = stubbed();
    await repo.listRange({
      from: new Date("2026-10-04T22:00:00Z"),
      to: new Date("2026-10-11T22:00:00Z"),
      fromDate: d("2026-10-05"),
      toDate: d("2026-10-12"),
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].get("or")).toBe(
      "(and(start_at.gte.2026-10-04T22:00:00.000Z,start_at.lt.2026-10-11T22:00:00.000Z),and(scheduled_on.gte.2026-10-05,scheduled_on.lt.2026-10-12))",
    );
    expect(requests[0].get("order")).toBe("start_at.asc.nullslast,scheduled_on.asc,position.asc");
    expect(requests[0].get("limit")).toBe("500");
  });
});

/**
 * A repo over a table of `rows` that answers like PostgREST: at most `maxRows`
 * per reply, with the total in `content-range` when the request asks for a count.
 */
function served(rows: unknown[], maxRows: number) {
  const pages: [number, number][] = [];
  const db = createClient("http://db.test", "anon", {
    global: {
      fetch: async (input, init) => {
        const params = new URL(String(input)).searchParams;
        const offset = Number(params.get("offset") ?? 0);
        const limit = Math.min(Number(params.get("limit") ?? Infinity), maxRows);
        pages.push([offset, limit]);
        const page = rows.slice(offset, offset + limit);
        const counted = new Headers(init?.headers).get("prefer")?.includes("count=exact");
        const range = `${offset}-${offset + page.length - 1}/${counted ? rows.length : "*"}`;
        return new Response(JSON.stringify(page), {
          status: 200,
          headers: { "content-type": "application/json", "content-range": range },
        });
      },
    },
  });
  return { repo: new SupabaseItemsRepo(db), pages };
}

describe("SupabaseItemsRepo reads that must be complete", () => {
  const parent = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;

  it("counts every child of the parents, past a server cap smaller than its page", async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => ({ parent_id: parent(i % 2), status: i % 3 === 0 ? "done" : "open" }));
    const { repo, pages } = served(rows, 500);

    const counts = await repo.childCounts([parent(0), parent(1)]);

    expect(counts[parent(0)]).toEqual({ total: 601, done: rows.filter((r, i) => i % 2 === 0 && r.status === "done").length });
    expect(counts[parent(1)].total).toBe(600);
    expect(pages).toEqual([
      [0, 500],
      [500, 500],
      [1000, 500],
    ]);
  });

  it("reads every override of a series, however old it is", async () => {
    const override = (i: number) => ({
      id: parent(i),
      type: "task",
      title: "Gym",
      status: "dropped",
      area_id: null,
      parent_id: null,
      position: 0,
      start_at: null,
      end_at: null,
      scheduled_on: "2020-01-01",
      due_on: null,
      rrule: null,
      series_id: SERIES,
      original_on: "2020-01-01",
      completed_at: null,
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
    });
    const { repo, pages } = served(Array.from({ length: 2500 }, (_, i) => override(i + 100)), 1000);

    const overrides = await repo.listOverrides(d("0001-01-01"), d("9999-12-31"), SERIES);

    expect(overrides).toHaveLength(2500);
    expect(new Set(overrides.map((o) => o.id)).size).toBe(2500);
    expect(pages).toHaveLength(3);
  });

  it("reads the tags of many items past the row cap", async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      item_id: parent(i % 200),
      tags: { id: `00000000-0000-4000-b000-${String(i % 10).padStart(12, "0")}`, name: `t${i % 10}` },
    }));
    const { repo } = served(rows, 1000);

    const byItem = await repo.tagsForItems(Array.from({ length: 200 }, (_, i) => parent(i)));

    expect(Object.keys(byItem)).toHaveLength(200);
    expect(Object.values(byItem).every((tags) => tags.length === 10)).toBe(true);
  });
});
