import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { NO_FILTER } from "@/features/filter/model";
import { makeItem } from "@/features/today/test-support";
import { DUE_SOON_SHOWN, dueSoon } from "./due-soon";

const d = (s: string) => s as LocalDate;
const TODAY = d("2026-11-16");
const due = (title: string, dueOn: string, over = {}) => makeItem({ title, dueOn: d(dueOn), ...over });

describe("dueSoon", () => {
  it("lists open items due from today on, soonest first", () => {
    const data = dueSoon([due("Later", "2026-11-30"), due("Today", "2026-11-16"), due("Tomorrow", "2026-11-17")], TODAY)!;
    expect(data.rows.map((r) => [r.title, r.chip])).toEqual([
      ["Today", "Today"],
      ["Tomorrow", "Tomorrow"],
      ["Later", "30 Nov"],
    ]);
    expect(data.rows[0].words).toBe("Due today");
  });

  it("leaves out done items, past dates and items with no due date", () => {
    const data = dueSoon([due("Done", "2026-11-17", { status: "done" }), due("Past", "2026-11-10"), makeItem({ title: "None" }), due("Soon", "2026-11-18")], TODAY)!;
    expect(data.rows.map((r) => r.title)).toEqual(["Soon"]);
  });

  it("names the first few and counts all", () => {
    const items = Array.from({ length: 7 }, (_, i) => due(`T${i}`, `2026-11-${20 + i}`));
    const data = dueSoon(items, TODAY)!;
    expect(data.rows).toHaveLength(DUE_SOON_SHOWN);
    expect(data.total).toBe(7);
  });

  it("is null when nothing is due, or under a tag filter", () => {
    expect(dueSoon([], TODAY)).toBeNull();
    expect(dueSoon([due("A", "2026-11-18")], TODAY, { ...NO_FILTER, tag: "errands" as never })).toBeNull();
  });
});
