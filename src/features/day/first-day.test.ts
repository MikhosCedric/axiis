import { describe, expect, it } from "vitest";
import type { Area, AreaId } from "@/domain/item";
import { parseCapture, previewWords } from "@/features/today/capture-syntax";
import { CAPTURE_EXAMPLES, exampleBeams } from "./first-day";

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
    const [work, home] = areas("Studio", "Garden");
    expect(shown([{ ...home, position: 0 }, { ...work, position: 1 }]).map((r) => r[0])).toEqual(["Garden", "Studio"]);
    expect(shown([{ ...home, position: 0 }, { ...work, position: 1 }])[0][1]).toBe("Write the plan");
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

describe("CAPTURE_EXAMPLES", () => {
  it("are lines capture reads as written: two plans and one plain line", () => {
    expect(CAPTURE_EXAMPLES.map((line) => previewWords(parseCapture(line)) !== null)).toEqual([true, true, false]);
    expect(parseCapture(CAPTURE_EXAMPLES[0])).toMatchObject({ title: "dentist", time: { start: 540 }, tags: ["health"] });
    expect(parseCapture(CAPTURE_EXAMPLES[1])).toMatchObject({ title: "call Sam", time: { start: 840, length: 30 } });
  });
});
