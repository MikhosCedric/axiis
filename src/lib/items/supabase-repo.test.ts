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
    // Day: timed, day-only, unscheduled. Range: timed, day-only. A series always has a schedule.
    expect(requests.map((q) => q.get("rrule"))).toEqual(["is.null", "is.null", null, "is.null", "is.null"]);
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
