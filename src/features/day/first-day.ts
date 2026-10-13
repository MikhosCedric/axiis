import type { Area, AreaId } from "@/domain/item";
import type { Span } from "@/features/score/layout";

/** An example beam drawn on an empty account's first Score. Never stored, never interactive. */
export type ExampleBeam = { areaId: AreaId; title: string; span: Span };

/** Each example suits the seeded area it is named for; any other area takes whichever is left, in order. */
const EXAMPLES = [
  { suits: "work", title: "Write the plan", span: { start: 10 * 60, end: 11 * 60 } },
  { suits: "home", title: "Groceries", span: { start: 18 * 60, end: 18 * 60 + 45 } },
  { suits: "health", title: "Walk", span: { start: 12 * 60 + 30, end: 13 * 60 } },
] as const;

/** One example beam for each of the first three areas by position. */
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

/** Lines the capture field's placeholder turns through on the first day, each one real capture syntax. */
export const CAPTURE_EXAMPLES = ["dentist tomorrow 9:00 #health", "call Sam friday 14:00 for 30m", "buy milk"] as const;

/** Above the capture field on the first day. */
export const CAPTURE_LEAD = "Type one thing you have to do. Add a day or a time and it lands on its line.";

/** Under the Score on the first day, where the key and help usually sit. */
export const EXAMPLES_NOTE = "The faint beams are examples. They go once you add your first item.";
