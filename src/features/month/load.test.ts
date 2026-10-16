import { describe, expect, it } from "vitest";
import type { Item, ItemId, LocalDate } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { addDays, instantAt } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import { loadMonth } from "./load";
import { MARKS_PER_DAY, monthOf, type YearMonth } from "./model";

const d = (s: string) => s as LocalDate;
const ym = (s: string) => s as YearMonth;
const NY = "America/New_York";
const NOW = new Date("2026-10-14T16:00:00Z");

/** Counts every read the month makes, by method. */
function counted(repo: ItemsRepo) {
  const reads: Record<string, number> = {};
  const wrapped = Object.fromEntries(
    Object.entries(repo).map(([name, fn]) => [
      name,
      (...args: unknown[]) => {
        reads[name] = (reads[name] ?? 0) + 1;
        return (fn as (...a: unknown[]) => unknown)(...args);
      },
    ]),
  ) as unknown as ItemsRepo;
  return { repo: wrapped, reads };
}

const DAILY: Rule = { freq: "daily", interval: 1, end: { kind: "never" } };
const WEEKLY: Rule = { freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: { kind: "never" } };

/** 200 timed series, the most `listSeries` returns, first planned `ageDays` before the month. */
function seriesAccount(ageDays: number, rule: Rule, around: LocalDate): Item[] {
  return Array.from({ length: 200 }, (_, i) => {
    const on = addDays(around, -ageDays - (i % 7));
    const start = instantAt(on, 8 * 60 + (i % 10) * 30, NY);
    return makeItem({
      id: `00000000-0000-4000-a000-${String(i).padStart(12, "0")}` as ItemId,
      title: `Series ${i}`,
      schedule: { kind: "timed", start, end: new Date(start.getTime() + 1_800_000) },
      recurrence: { kind: "series", rule },
    });
  });
}

describe("loadMonth", () => {
  it("reads the grid once: one planned read, one due read, one series read and one override read, never a read per day", async () => {
    const { repo, reads } = counted(fakeRepo(seriesAccount(0, DAILY, d("2026-10-01"))).repo);
    await loadMonth(repo, ym("2026-10"), NOW, NY, "24");
    expect(reads).toEqual({ listAreas: 1, listRange: 1, listSeries: 1, listOverrides: 1, listDueIn: 1 });
  });

  it("reads the span from the evening before the grid, and the due dates of the grid", async () => {
    const { repo } = fakeRepo();
    const spans: unknown[] = [];
    const due: unknown[] = [];
    const listRange = repo.listRange;
    const listDueIn = repo.listDueIn;
    repo.listRange = (r) => (spans.push(r), listRange(r));
    repo.listDueIn = (from, to) => (due.push([from, to]), listDueIn(from, to));
    await loadMonth(repo, ym("2026-10"), NOW, NY, "24");
    expect(spans).toEqual([
      { from: new Date("2026-09-27T04:00:00Z"), to: new Date("2026-11-02T05:00:00Z"), fromDate: "2026-09-27", toDate: "2026-11-02" },
    ]);
    expect(due).toEqual([["2026-09-28", "2026-11-02"]]);
  });

  it("expands a daily series at its wall-clock time on every day of a month the clocks change", async () => {
    const start = instantAt(d("2026-01-05"), 8 * 60, NY);
    const gym = makeItem({
      title: "Gym",
      schedule: { kind: "timed", start, end: new Date(start.getTime() + 3_600_000) },
      recurrence: { kind: "series", rule: DAILY },
    });
    for (const month of ["2026-03", "2026-11"]) {
      const data = await loadMonth(fakeRepo([gym]).repo, ym(month), NOW, NY, "24");
      const days = data.cells.filter((c) => monthOf(c.date) === month);
      expect(days.every((c) => c.marks.length === 1 && c.marks[0].time === "08:00"), month).toBe(true);
      expect(days.every((c) => c.marks[0].key === `${gym.id}~${c.date}` && c.marks[0].repeats)).toBe(true);
    }
  });

  it("sends at most three marks a day, and counts the rest", async () => {
    const data = await loadMonth(fakeRepo(seriesAccount(0, DAILY, d("2026-10-01"))).repo, ym("2026-10"), NOW, NY, "24");
    const october = data.cells.find((c) => c.date === "2026-10-20")!;
    expect(october.marks).toHaveLength(MARKS_PER_DAY);
    expect(october.more).toBe(200 - MARKS_PER_DAY);
    expect(data.summary).toBe(`${200 * 31} open this month.`);
  });

  it("draws the same month from a five-year-old series as from a new one", async () => {
    for (const rule of [DAILY, WEEKLY]) {
      const fresh = await loadMonth(fakeRepo(seriesAccount(0, rule, d("2026-10-01"))).repo, ym("2026-10"), NOW, NY, "24");
      const old = await loadMonth(fakeRepo(seriesAccount(5 * 365, rule, d("2026-10-01"))).repo, ym("2026-10"), NOW, NY, "24");
      const shape = (data: typeof fresh) => data.cells.filter((c) => c.date >= "2026-10-08").map((c) => [c.date, c.marks.length + c.more]);
      expect(shape(old)).toEqual(shape(fresh));
    }
  });
});

function medianMs(run: () => Promise<unknown>, rounds = 15): Promise<number> {
  return (async () => {
    for (let i = 0; i < 3; i++) await run();
    const times: number[] = [];
    for (let i = 0; i < rounds; i++) {
      const t = performance.now();
      await run();
      times.push(performance.now() - t);
    }
    return times.sort((a, b) => a - b)[Math.floor(rounds / 2)];
  })();
}

// Skipped in the suite. Run with `BENCH=1 npx vitest run src/features/month/load.test.ts`.
describe.runIf(process.env.BENCH)("loadMonth benchmark", () => {
  it("times one month of 200 series, new and old", async () => {
    const rows: string[] = [];
    const byAge: Record<string, number[]> = {};
    for (const rule of [DAILY, WEEKLY]) {
      for (const [label, age] of [["new", 0], ["1 year old", 365], ["5 years old", 1826]] as const) {
        const repo = fakeRepo(seriesAccount(age, rule, d("2026-10-01"))).repo;
        const ms = await medianMs(() => loadMonth(repo, ym("2026-10"), NOW, NY, "24"));
        (byAge[rule.freq] ??= []).push(ms);
        rows.push(`${rule.freq}\tmonth\t${label}\t${ms.toFixed(1)} ms`);
      }
    }
    process.stdout.write(`${rows.join("\n")}\n`);
    for (const [fresh, , old] of Object.values(byAge)) expect(old).toBeLessThan(fresh * 2 + 5);
  }, 300_000);
});
