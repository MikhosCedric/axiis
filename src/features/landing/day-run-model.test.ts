import { describe, expect, it } from "vitest";
import { FLAG_STEP, PHASES, RUN_AXIS, RUN_STAVES, STILL_HOUR, rangeAt, shareOf } from "./day-run-model";
import { stateAt } from "./live-day";

const beams = RUN_STAVES.flatMap((s) => s.beams);

describe("the day the landing runs through", () => {
  it("turns every beam over inside the run, and never two on one staff at once", () => {
    for (const staff of RUN_STAVES) {
      for (const beam of staff.beams) {
        expect(beam.start, beam.title).toBeGreaterThan(RUN_AXIS.from);
        expect(beam.end, beam.title).toBeLessThan(RUN_AXIS.to);
        expect(staff.beams.filter((b) => b !== beam && b.start < beam.end && beam.start < b.end), beam.title).toEqual([]);
      }
    }
  });

  it("names the part of the day for every hour of the run, morning to evening, with no gap", () => {
    expect(PHASES[0].from).toBe(RUN_AXIS.from);
    expect(PHASES.at(-1)!.to).toBe(RUN_AXIS.to);
    for (let i = 1; i < PHASES.length; i++) expect(PHASES[i].from).toBe(PHASES[i - 1].to);
  });

  it("draws all three line forms in the still frame", () => {
    const forms = new Set(beams.map((b) => stateAt(b, STILL_HOUR)));
    expect(forms).toEqual(new Set(["done", "live", "planned"]));
    expect(beams.filter((b) => stateAt(b, STILL_HOUR) === "live")).toHaveLength(1);
  });

  it("puts each hour at its share of the scroll", () => {
    expect(shareOf(RUN_AXIS.from)).toBe(0);
    expect(shareOf(RUN_AXIS.to)).toBe(1);
    expect(shareOf(15)).toBe(0.5);
    expect(rangeAt(15)).toEqual({ from: "50%", to: "51.5%" });
    expect(rangeAt(RUN_AXIS.to)).toEqual({ from: "100%", to: "100%" });
  });

  it("steps the clock flag in whole quarter hours across the run", () => {
    expect(((RUN_AXIS.to - RUN_AXIS.from) / FLAG_STEP) % 1).toBe(0);
    expect(((STILL_HOUR - RUN_AXIS.from) / FLAG_STEP) % 1).toBe(0);
  });
});
