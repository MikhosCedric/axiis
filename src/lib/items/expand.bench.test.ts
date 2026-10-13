// One page's expansion: the 200 series `listSeries` reads at most, over a day and over a week.
// Skipped in the suite. Run with `BENCH=1 npx vitest run src/lib/items/expand.bench.test.ts`.
import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate, SpanRange } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import { addDays, dayRangeFor, instantAt } from "@/lib/dates";
import { expandSeries, type SeriesSource } from "./expand";

const TZ = "America/New_York";
const TODAY = "2026-10-13" as LocalDate;
const RULES: Rule[] = [
  { freq: "daily", interval: 1, end: { kind: "never" } },
  { freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: { kind: "never" } },
];
const AGES = [
  ["new", 0],
  ["1 year old", 365],
  ["5 years old", 1826],
] as const;

function page(ageDays: number, rule: Rule): SeriesSource[] {
  return Array.from({ length: 200 }, (_, i) => {
    const on = addDays(TODAY, -ageDays - (i % 7));
    const start = instantAt(on, 540, TZ);
    return { id: `s${i}` as ItemId, rule, schedule: { kind: "timed", start, end: new Date(start.getTime() + 3_600_000) } };
  });
}

function span(days: number): SpanRange {
  const toDate = addDays(TODAY, days);
  return { from: dayRangeFor(TODAY, TZ).from, to: dayRangeFor(toDate, TZ).from, fromDate: TODAY, toDate };
}

function medianMs(run: () => void, rounds = 15): number {
  for (let i = 0; i < 3; i++) run();
  const times = Array.from({ length: rounds }, () => {
    const t = performance.now();
    run();
    return performance.now() - t;
  }).sort((a, b) => a - b);
  return times[Math.floor(rounds / 2)];
}

describe.runIf(process.env.BENCH)("expandSeries benchmark", () => {
  it("times one page of 200 series", () => {
    const rows: string[] = [];
    for (const rule of RULES) {
      for (const days of [1, 7]) {
        for (const [label, age] of AGES) {
          const series = page(age, rule);
          const sp = span(days);
          let occurrences = 0;
          const ms = medianMs(() => {
            occurrences = 0;
            for (const s of series) occurrences += expandSeries(s, sp, TZ).length;
          });
          rows.push(`${rule.freq}\t${days}d span\t${label}\t${ms.toFixed(1)} ms\t${occurrences} occurrences`);
        }
      }
    }
    process.stdout.write(`${rows.join("\n")}\n`);
    expect(rows).toHaveLength(12);
  }, 300_000);
});
