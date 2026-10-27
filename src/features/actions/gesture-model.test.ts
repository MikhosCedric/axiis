import { describe, expect, it } from "vitest";
import { SWIPE, swipeAxis, swipeEnd, swipeReach } from "./gesture-model";

describe("swipeAxis", () => {
  it("waits until the finger has gone far enough to tell", () => {
    expect(swipeAxis(6, 6)).toBeNull();
  });

  it("calls a mostly sideways move a swipe and anything steeper a scroll", () => {
    expect(swipeAxis(20, 5)).toBe("x");
    expect(swipeAxis(-20, 10)).toBe("x");
    expect(swipeAxis(12, 10)).toBe("y");
    expect(swipeAxis(2, -30)).toBe("y");
  });
});

describe("swipeEnd", () => {
  it("ticks past the done distance to the right, shows Plan and Delete past the reveal distance to the left", () => {
    expect(swipeEnd(SWIPE.done)).toBe("done");
    expect(swipeEnd(SWIPE.done - 1)).toBe("close");
    expect(swipeEnd(-SWIPE.reveal)).toBe("open");
    expect(swipeEnd(-SWIPE.reveal + 1)).toBe("close");
  });
});

describe("swipeReach", () => {
  it("follows the finger, then slows past where letting go acts", () => {
    expect(swipeReach(40)).toBe(40);
    expect(swipeReach(-100)).toBe(100);
    expect(swipeReach(SWIPE.done * 1.5 + 20)).toBe(SWIPE.done * 1.5 + 10);
    expect(swipeReach(-(SWIPE.open + 40))).toBe(SWIPE.open + 20);
  });
});
