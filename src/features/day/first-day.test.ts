import { describe, expect, it } from "vitest";
import type { Area, AreaId } from "@/domain/item";
import { exampleBeams } from "./first-day";

const areas = (...names: string[]): Area[] => names.map((name, position) => ({ id: `area-${name}` as AreaId, name, position }));
const shown = (list: Area[]) => exampleBeams(list).map((b) => [b.areaId.slice(5), b.title, b.span.start, b.span.end]);

describe("exampleBeams", () => {
  it("puts the plan on Work at 10:00, groceries on Home at 18:00 and a walk on Health at 12:30", () => {
    expect(shown(areas("Work", "Home", "Health"))).toEqual([
      ["Work", "Write the plan", 600, 660],
      ["Home", "Groceries", 1080, 1125],
      ["Health", "Walk", 750, 780],
    ]);
  });

  it("follows the seeded names wherever they sit, in any case", () => {
    expect(shown(areas("health", "WORK", "Home"))).toEqual([
      ["health", "Walk", 750, 780],
      ["WORK", "Write the plan", 600, 660],
      ["Home", "Groceries", 1080, 1125],
    ]);
  });

  it("gives other areas the examples left over, in position order", () => {
    expect(shown(areas("Studio", "Health", "Garden"))).toEqual([
      ["Studio", "Write the plan", 600, 660],
      ["Health", "Walk", 750, 780],
      ["Garden", "Groceries", 1080, 1125],
    ]);
  });

  it("orders areas by position, not by the order they arrive in", () => {
    const [studio, garden, desk, shed] = areas("Studio", "Garden", "Desk", "Shed");
    expect(shown([shed, garden, desk, studio]).map((r) => r.slice(0, 2))).toEqual([
      ["Studio", "Write the plan"],
      ["Garden", "Groceries"],
      ["Desk", "Walk"],
    ]);
  });

  it("draws at most three, and none without areas", () => {
    expect(shown(areas("A", "B", "C", "D", "E")).map((r) => r[0])).toEqual(["A", "B", "C"]);
    expect(exampleBeams([])).toEqual([]);
  });

  it("returns spans a caller may change without changing the next call's", () => {
    exampleBeams(areas("Work"))[0].span.start = 0;
    expect(exampleBeams(areas("Work"))[0].span.start).toBe(600);
  });
});
