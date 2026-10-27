import { describe, expect, it } from "vitest";
import { placeNear, rovingStep } from "./placement";

describe("placeNear", () => {
  const view = { width: 400, height: 600 };
  const size = { width: 200, height: 150 };

  it("sits under its anchor, left edges lined up", () => {
    expect(placeNear({ left: 40, top: 100, width: 30, height: 20 }, size, view)).toEqual({ left: 40, top: 124 });
  });

  it("flips above when there is no room below, and stays inside the window", () => {
    expect(placeNear({ left: 300, top: 500, width: 30, height: 20 }, size, view)).toEqual({ left: 184, top: 346 });
  });

  it("holds the margin when the window is too short either way", () => {
    expect(placeNear({ left: 0, top: 60, width: 0, height: 0 }, { width: 200, height: 560 }, view)).toEqual({ left: 16, top: 24 });
  });
});

describe("rovingStep", () => {
  it("moves either way with the arrows, wrapping, and to the ends with Home and End", () => {
    expect(rovingStep("ArrowRight", 2, 3)).toBe(0);
    expect(rovingStep("ArrowDown", 0, 3)).toBe(1);
    expect(rovingStep("ArrowLeft", 0, 3)).toBe(2);
    expect(rovingStep("ArrowUp", 1, 3)).toBe(0);
    expect(rovingStep("Home", 2, 3)).toBe(0);
    expect(rovingStep("End", 0, 3)).toBe(2);
    expect(rovingStep("Enter", 0, 3)).toBeNull();
    expect(rovingStep("ArrowRight", 0, 0)).toBeNull();
  });
});
