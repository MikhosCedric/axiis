import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import type { TagName } from "@/domain/tag";
import { dayGlance, glanceLine } from "@/features/day/glance";
import { loadDay } from "@/features/day/load";
import { loadLeftover } from "@/features/day/leftover";
import { loadMonth } from "@/features/month/load";
import { type YearMonth } from "@/features/month/model";
import { area, fakeRepo, makeItem } from "@/features/today/test-support";
import { loadInbox } from "@/features/inbox/commands";
import { loadWeek } from "@/features/week/load";
import { filterDay, filterInbox, filterRows, filterWeek } from "./apply";
import { areaSection } from "@/features/palette/model";
import { areaHref, filterable, withFilter } from "./href";
import { filterWords, keeps, NO_FILTER, readFilter, scopePrefix, scopeWords, type ViewFilter } from "./model";

const work = { ...area("Work"), color: "slate" as const };
const home = area("Home");
const DAY = "2026-10-08" as LocalDate;
const NOW = new Date("2026-10-08T06:00:00Z");
const hh = (h: number) => String(h).padStart(2, "0");
const at = (h: number) => ({ kind: "timed" as const, start: new Date(`2026-10-08T${hh(h)}:00:00Z`), end: new Date(`2026-10-08T${hh(h)}:30:00Z`) });

describe("readFilter", () => {
  it("takes an area only when it is one of the user's, and ignores anything else safely", () => {
    const areas = [work, home];
    expect(readFilter({ area: work.id }, areas, { tags: true }).area).toEqual(work);
    for (const odd of ["00000000-0000-4000-a000-000000000999", "", "Work", undefined, [work.id, home.id]]) {
      expect(readFilter({ area: odd }, areas, { tags: true })).toEqual(NO_FILTER);
    }
  });

  it("reads a tag as its stored form, ignores one that cannot be a tag, and ignores tags on views that read none", () => {
    expect(readFilter({ tag: "#Errands " }, [], { tags: true }).tag).toBe("Errands");
    expect(readFilter({ tag: "   " }, [], { tags: true }).tag).toBeNull();
    expect(readFilter({ tag: "x".repeat(40) }, [], { tags: true }).tag).toBeNull();
    expect(readFilter({ tag: "errands" }, [], { tags: false }).tag).toBeNull();
  });
});

describe("keeps and the words", () => {
  const both: ViewFilter = { area: work, tag: "errands" as TagName };

  it("keeps an item in the area that wears the tag in any case, and nothing else", () => {
    expect(keeps(both, { areaId: work.id }, ["Errands"])).toBe(true);
    expect(keeps(both, { areaId: work.id }, ["home"])).toBe(false);
    expect(keeps(both, { areaId: home.id }, ["errands"])).toBe(false);
    expect(keeps(both, { areaId: null }, undefined)).toBe(false);
    expect(keeps(NO_FILTER, { areaId: null }, undefined)).toBe(true);
  });

  it("names the filter after a count and before a summary, and says nothing for a whole view", () => {
    expect(filterWords(both)).toBe("Work and #errands");
    expect(scopeWords({ area: work, tag: null })).toBe(" in Work");
    expect(scopePrefix({ area: null, tag: "deep" as TagName })).toBe("In #deep: ");
    expect([scopeWords(NO_FILTER), scopePrefix(NO_FILTER)]).toEqual(["", ""]);
  });
});

describe("withFilter", () => {
  it("sets and removes the filter's values and keeps every other parameter", () => {
    expect(withFilter("/today", { area: "a1" })).toBe("/today?area=a1");
    expect(withFilter("/day/2026-10-08?view=list", { area: "a1", tag: "deep work" })).toBe("/day/2026-10-08?view=list&area=a1&tag=deep+work");
    expect(withFilter("/week?area=a1&item=x", { area: null })).toBe("/week?item=x");
    expect(withFilter("/week?area=a1", { area: null, tag: null })).toBe("/week");
    expect(withFilter("/month?area=a1", {})).toBe("/month?area=a1");
  });
});

describe("areaHref", () => {
  it("narrows the page you are on, keeping its own parameters and dropping the open item", () => {
    expect(areaHref("/week/2026-10-05", "item=x&tag=deep", "a1")).toBe("/week/2026-10-05?tag=deep&area=a1");
    expect(areaHref("/day/2026-10-08", "view=list&area=a0", "a1")).toBe("/day/2026-10-08?view=list&area=a1");
    expect(areaHref("/inbox", "area=a1", null)).toBe("/inbox");
  });

  it("goes to Today from a page that cannot be narrowed, leaving that page's parameters behind", () => {
    for (const path of ["/settings", "/tags/deep", "/notes/abc", "/search"]) {
      expect(areaHref(path, "q=x", "a1")).toBe("/today?area=a1");
    }
    expect(["/today", "/month", "/month/2026-11", "/due", "/lists", "/notes"].every(filterable)).toBe(true);
  });
});

describe("areaSection", () => {
  const areas = [work, home];
  const here = { pathname: "/week", query: "area=" + work.id };

  it("offers each matching area and, while one is shown, every area again, by prefix or substring only", () => {
    const labels = (input: string) => areaSection(input, areas, here).flatMap((s) => s.commands.map((c) => c.label));
    expect(labels("")).toEqual([]);
    expect(labels("wor")).toEqual(["Show only Work"]);
    expect(labels("show")).toEqual(["Show only Work", "Show only Home", "Show all areas"]);
    expect(labels("area")).toEqual(["Show only Work", "Show only Home", "Show all areas"]);
    expect(labels("wk")).toEqual([]);
    expect(areaSection("show", areas, { pathname: "/week", query: "" })[0].commands.map((c) => c.label)).not.toContain("Show all areas");
  });

  it("links each choice to this page, narrowed or widened", () => {
    const [section] = areaSection("show", areas, here);
    expect(section.commands.map((c) => (c.kind === "go" ? c.href : null))).toEqual([`/week?area=${work.id}`, `/week?area=${home.id}`, "/week"]);
  });
});

describe("filtering loaded views", () => {
  function account() {
    const items = [
      makeItem({ title: "Deck", areaId: work.id, schedule: at(9) }),
      makeItem({ title: "Review", areaId: work.id, schedule: at(11), status: "done" }),
      makeItem({ title: "Laundry", areaId: home.id, schedule: at(10) }),
      makeItem({ title: "Loose", areaId: null, schedule: { kind: "day", on: DAY } }),
      makeItem({ title: "Inbox for work", areaId: work.id }),
      makeItem({ title: "Inbox for home", areaId: home.id }),
    ];
    const fake = fakeRepo(items, [work, home]);
    fake.tag(items[2].id, "errands");
    fake.tag(items[5].id, "Errands");
    return { ...fake, list: items };
  }

  it("narrows a day to the area's items and its one staff, and the glance counts only those", async () => {
    const { repo } = account();
    const day = await loadDay(repo, DAY, NOW, "UTC");
    const filter: ViewFilter = { area: work, tag: null };
    const shown = filterDay(day, filter);
    expect(shown.areas).toEqual([work]);
    expect(shown.view.scheduled.map((e) => e.item.title)).toEqual(["Deck", "Review"]);
    expect(shown.view.waiting.map((e) => e.item.title)).toEqual(["Inbox for work"]);
    const glance = dayGlance(shown.view, DAY, DAY, NOW);
    expect(glanceLine(glance, () => "09:00", scopeWords(filter))).toBe("Today · 1 of 2 done in Work · next: Deck at 09:00");
    expect(filterDay(day, NO_FILTER)).toBe(day);
  });

  it("narrows a day, a week and the Inbox to a tag in any case, from the tags they already read", async () => {
    const { repo } = account();
    const filter: ViewFilter = { area: null, tag: "ERRANDS" as TagName };
    const day = filterDay(await loadDay(repo, DAY, NOW, "UTC"), filter);
    expect([...day.view.scheduled, ...day.view.waiting].map((e) => e.item.title)).toEqual(["Laundry", "Inbox for home"]);
    expect(day.areas).toHaveLength(2);
    const week = filterWeek(await loadWeek(repo, DAY, NOW, "UTC"), filter);
    expect([...week.scheduled, ...week.unscheduled].map((i) => i.title)).toEqual(["Laundry", "Inbox for home"]);
    const inbox = filterInbox(await loadInbox(repo, NOW, "UTC"), filter);
    expect(inbox.items.map((i) => i.title)).toEqual(["Inbox for home"]);
  });

  it("filters Due, Lists and Notes rows by the area they name", () => {
    const rows = [{ areaId: work.id }, { areaId: home.id }, { areaId: null }];
    expect(filterRows(rows, { area: work, tag: null })).toEqual([{ areaId: work.id }]);
    expect(filterRows(rows, NO_FILTER)).toBe(rows);
  });

  it("counts a filtered month before it caps the marks, so a day says how many more of the area's there are", async () => {
    const many = Array.from({ length: 6 }, (_, i) => makeItem({ title: `W${i}`, areaId: work.id, schedule: at(8 + i) }));
    const others = Array.from({ length: 6 }, (_, i) => makeItem({ title: `H${i}`, areaId: home.id, schedule: at(8 + i) }));
    const { repo } = fakeRepo([...many, ...others], [work, home]);
    const month = "2026-10" as YearMonth;
    const all = await loadMonth(repo, month, NOW, "UTC", "24");
    const mine = await loadMonth(repo, month, NOW, "UTC", "24", { area: work, tag: null });
    const cell = (data: typeof all) => data.cells.find((c) => c.date === DAY)!;
    expect(cell(all).marks.length + cell(all).more).toBe(12);
    expect(cell(mine).marks.length + cell(mine).more).toBe(6);
    expect(cell(mine).marks.every((m) => m.areaColor === "slate")).toBe(true);
    expect(mine.summary).toContain("6 open in Work");
  });

  it("shows only the area's left over items and offers no move-all, and none under a tag", async () => {
    const before = { kind: "day" as const, on: "2026-10-01" as LocalDate };
    const { repo } = fakeRepo(
      [makeItem({ title: "Old work", areaId: work.id, schedule: before }), makeItem({ title: "Old home", areaId: home.id, schedule: before })],
      [work, home],
    );
    const whole = await loadLeftover(repo, DAY, "UTC");
    expect(whole).toMatchObject({ total: 2, filtered: false });
    expect(await loadLeftover(repo, DAY, "UTC", { area: work, tag: null })).toMatchObject({ total: 1, filtered: true, rows: [{ title: "Old work" }] });
    expect(await loadLeftover(repo, DAY, "UTC", { area: null, tag: "x" as TagName })).toBeNull();
  });
});
