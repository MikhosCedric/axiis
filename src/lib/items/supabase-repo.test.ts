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
