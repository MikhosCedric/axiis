import { describe, expect, it } from "vitest";
import { scaleOf } from "@/features/calendar/grid-layout";
import { packSample } from "./grid-pack";
import { LANDING, LIVE_ANYTIME, LIVE_BLOCKS, LIVE_WINDOW, axisMinutes, nowParts, stateAt, stateOn, wallMinutesOf } from "./live-day";

const today = LIVE_BLOCKS.filter((b) => b.day === 0);

describe("the live sample day", () => {
  it("draws the same line forms at every minute of the day, with one block on now", () => {
    const first = today.map((b) => stateAt(b, nowParts(0).into));
    expect(first.filter((s) => s === "live")).toHaveLength(1);
    expect(first.filter((s) => s === "done").length).toBeGreaterThan(0);
    expect(first.filter((s) => s === "planned").length).toBeGreaterThan(0);
    for (let minute = 0; minute < 24 * 60; minute++) {
      expect(today.map((b) => stateAt(b, nowParts(minute).into)), `minute ${minute}`).toEqual(first);
    }
  });

  it("plans every block on the other days", () => {
    for (const b of LIVE_BLOCKS.filter((x) => x.day > 0)) expect(stateOn(b, 0.5), b.title).toBe("planned");
  });

  it("keeps every block inside the window drawn", () => {
    for (const b of LIVE_BLOCKS) {
      expect(b.start, b.title).toBeGreaterThanOrEqual(LIVE_WINDOW.from);
      expect(b.end, b.title).toBeLessThanOrEqual(LIVE_WINDOW.to);
    }
  });

  it("lands the Inbox item on a free, planned stretch of today", () => {
    expect(today.filter((b) => b.start < LANDING.end && LANDING.start < b.end)).toEqual([]);
    for (const into of [0, 0.5, 59 / 60]) expect(stateAt(LANDING, into)).toBe("planned");
    expect(LANDING.day).toBe(0);
  });

  it("gives the Any time row items on days that exist", () => {
    for (const a of LIVE_ANYTIME) expect([0, 1, 2]).toContain(a.day);
  });

  it("splits now into its hour and the fraction gone", () => {
    expect(nowParts(11 * 60 + 30)).toEqual({ hour: 11, into: 0.5 });
    expect(nowParts(0)).toEqual({ hour: 0, into: 0 });
    expect(nowParts(24 * 60 + 15)).toEqual({ hour: 0, into: 0.25 });
  });

  it("writes relative hours as wall-clock minutes across midnight, and on the grid's axis without wrapping", () => {
    expect(wallMinutesOf(-2.5, 1)).toBe(22 * 60 + 30);
    expect(wallMinutesOf(1.25, 23)).toBe(15);
    expect(wallMinutesOf(0, 11)).toBe(11 * 60);
    expect(axisMinutes(1.25, 23)).toBe(24 * 60 + 15);
  });

  it("sets overlapping blocks side by side, as the app's grid does", () => {
    const scale = scaleOf(axisMinutes(LIVE_WINDOW.from, 11), axisMinutes(LIVE_WINDOW.to, 11), 48);
    const packed = packSample(
      today.map((b) => ({ ...b, id: b.title, start: axisMinutes(b.start, 11), end: axisMinutes(b.end, 11) })),
      scale,
    );
    const plan = packed.find((p) => p.id === "Plan next week")!;
    const physio = packed.find((p) => p.id === "Physio exercises")!;
    expect(plan.columns).toBe(2);
    expect(physio.columns).toBe(2);
    expect(plan.column).not.toBe(physio.column);
    expect(packed.find((p) => p.id === "Groceries")!.columns).toBe(1);
  });
});
