import type { Area, AreaId } from "@/domain/item";
import type { GridExample } from "@/features/calendar/calendar-grid";

/** Minutes from midnight. */
type Span = { start: number; end: number };

/** An example drawn on an empty account's first day. Never stored, never interactive. */
export type ExampleBeam = { areaId: AreaId; title: string; span: Span };

/** Each example suits the seeded area it is named for; any other area takes whichever is left, in order. */
const EXAMPLES = [
  { suits: "work", title: "Write the plan", span: { start: 10 * 60, end: 11 * 60 } },
  { suits: "home", title: "Groceries", span: { start: 18 * 60, end: 18 * 60 + 45 } },
  { suits: "health", title: "Walk", span: { start: 12 * 60 + 30, end: 13 * 60 } },
] as const;

/** One example for each of the first three areas by position. */
export function exampleBeams(areas: readonly Area[]): ExampleBeam[] {
  const first = [...areas].sort((a, b) => a.position - b.position).slice(0, EXAMPLES.length);
  const left: (typeof EXAMPLES)[number][] = [...EXAMPLES];
  const named = new Map<AreaId, (typeof EXAMPLES)[number]>();
  for (const a of first) {
    const i = left.findIndex((e) => e.suits === a.name.trim().toLowerCase());
    if (i !== -1) named.set(a.id, left.splice(i, 1)[0]);
  }
  return first.map((a) => {
    const e = named.get(a.id) ?? left.shift()!;
    return { areaId: a.id, title: e.title, span: { ...e.span } };
  });
}

/** The same examples as the grid draws them: faint blocks on today, each in its area's colour. */
export function exampleBlocks(areas: readonly Area[]): GridExample[] {
  return exampleBeams(areas).map((e) => ({ title: e.title, start: e.span.start, end: e.span.end, color: areas.find((a) => a.id === e.areaId)?.color ?? null }));
}
