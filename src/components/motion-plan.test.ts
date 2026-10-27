import { describe, expect, it } from "vitest";
import { motionPlan, type Place } from "./motion-plan";

const at = (top: number, left = 0): Place => ({ top, left, width: 300, height: 48 });

describe("motionPlan", () => {
  it("glides a row that moved from where it was, and leaves one that stayed alone", () => {
    const before = new Map([["a", at(0)], ["b", at(48)], ["c", at(96)]]);
    const after = new Map([["a", at(0)], ["c", at(48)], ["b", at(96)]]);
    expect(motionPlan(before, after).moved).toEqual([
      { key: "c", dx: 0, dy: 48 },
      { key: "b", dx: 0, dy: -48 },
    ]);
  });

  it("names the rows that are new and the ones that left", () => {
    const before = new Map([["a", at(0)], ["b", at(48)]]);
    const after = new Map([["b", at(0)], ["n", at(48)]]);
    expect(motionPlan(before, after)).toEqual({ moved: [{ key: "b", dx: 0, dy: 48 }], entered: ["n"], left: ["a"] });
  });

  it("calls a shift under a pixel no move, and follows a row across", () => {
    expect(motionPlan(new Map([["a", at(0.4)]]), new Map([["a", at(0)]])).moved).toEqual([]);
    expect(motionPlan(new Map([["a", at(0, 140)]]), new Map([["a", at(0, 0)]])).moved).toEqual([{ key: "a", dx: 140, dy: 0 }]);
  });
});
