import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { dayWords, inboxRows, inboxSummary, parsePlanFor, planDate, quickPlans, rowKey } from "./model";

const d = (s: string) => s as LocalDate;
const TODAY = d("2026-12-31");

describe("plan days", () => {
  it("reads today, tomorrow and real dates, and nothing else", () => {
    expect(["today", "tomorrow", "2027-01-04"].map(parsePlanFor)).toEqual(["today", "tomorrow", "2027-01-04"]);
    expect([null, "Today", "yesterday", "2026-02-30", "2026-10-08T00:00", 3].map(parsePlanFor)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("turns a choice into a date, across a year end", () => {
    expect(planDate("today", TODAY)).toBe("2026-12-31");
    expect(planDate("tomorrow", TODAY)).toBe("2027-01-01");
    expect(planDate(d("2027-02-14"), TODAY)).toBe("2027-02-14");
  });

  it("names the day in words", () => {
    expect(dayWords(TODAY, TODAY)).toBe("today");
    expect(dayWords(d("2027-01-01"), TODAY)).toBe("tomorrow");
    expect(dayWords(d("2027-01-02"), TODAY)).toMatch(/^Saturday 2 January$/);
  });
});

describe("inboxRows", () => {
  const older = makeItem({ title: "Older", createdAt: new Date("2026-10-01T00:00:00Z") });
  const newer = makeItem({ title: "Newer", createdAt: new Date("2026-10-05T00:00:00Z") });

  it("keeps an item ticked done on this visit, in its place, after the server drops it", () => {
    const ticked = { ...older, status: "done" as const };
    expect(inboxRows([newer], [ticked]).map((i) => [i.title, i.status])).toEqual([
      ["Newer", "open"],
      ["Older", "done"],
    ]);
  });

  it("shows a ticked item as done while the server still has it open", () => {
    const ticked = { ...older, status: "done" as const };
    expect(inboxRows([older, newer], [ticked]).map((i) => [i.title, i.status])).toEqual([
      ["Newer", "open"],
      ["Older", "done"],
    ]);
  });
});

describe("inboxSummary", () => {
  it("counts what is still open", () => {
    const open = makeItem();
    const done = makeItem({ status: "done" });
    expect(inboxSummary([])).toBe("Nothing here now.");
    expect(inboxSummary([done])).toBe("Everything here is done.");
    expect(inboxSummary([open, done])).toBe("1 to plan.");
    expect(inboxSummary([open, open])).toBe("2 to plan.");
  });
});

describe("quick plans and row keys", () => {
  it("offers today, tomorrow and the Monday of next week, from a Thursday and from a Sunday", () => {
    expect(quickPlans(TODAY).map((q) => [q.key, q.label, planDate(q.when, TODAY)])).toEqual([
      ["1", "Today", "2026-12-31"],
      ["2", "Tomorrow", "2027-01-01"],
      ["3", "Next week", "2027-01-04"],
    ]);
    expect(planDate(quickPlans(d("2027-01-03"))[2].when, d("2027-01-03"))).toBe("2027-01-04");
  });

  it("moves with j, k and the arrows, plans with 1 to 3 and picks a day with 4", () => {
    expect(["j", "ArrowDown", "k", "ArrowUp"].map((k) => rowKey(k, TODAY))).toEqual([{ move: 1 }, { move: 1 }, { move: -1 }, { move: -1 }]);
    expect(["1", "2", "3"].map((k) => rowKey(k, TODAY))).toEqual([{ plan: "today" }, { plan: "tomorrow" }, { plan: "2027-01-04" }]);
    expect(rowKey("4", TODAY)).toEqual({ pick: true });
    expect(["5", "J", "Enter", " ", "x"].map((k) => rowKey(k, TODAY))).toEqual([null, null, null, null, null]);
  });
});
