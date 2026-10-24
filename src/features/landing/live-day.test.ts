import { describe, expect, it } from "vitest";
import { LANDING, LIVE_STAVES, WIDEST, nowParts, roomAfter, stateAt, wallMinutesOf } from "./live-day";

const beams = LIVE_STAVES.flatMap((s) => s.beams);

describe("the live sample day", () => {
  it("draws the same line forms at every minute of the day, with one beam on now", () => {
    const first = beams.map((b) => stateAt(b, nowParts(0).into));
    expect(first.filter((s) => s === "live")).toHaveLength(1);
    expect(first.filter((s) => s === "done").length).toBeGreaterThan(0);
    expect(first.filter((s) => s === "planned").length).toBeGreaterThan(0);
    for (let minute = 0; minute < 24 * 60; minute++) {
      expect(beams.map((b) => stateAt(b, nowParts(minute).into)), `minute ${minute}`).toEqual(first);
    }
  });

  it("keeps every beam inside the widest window and apart from the others on its row", () => {
    for (const staff of LIVE_STAVES) {
      for (const beam of staff.beams) {
        expect(beam.start).toBeGreaterThanOrEqual(WIDEST.from);
        expect(beam.end).toBeLessThanOrEqual(WIDEST.to);
        const overlapping = staff.beams.filter((b) => b !== beam && b.row === beam.row && b.start < beam.end && beam.start < b.end);
        expect(overlapping, beam.title).toEqual([]);
      }
    }
  });

  it("lands the Inbox chip on a free, planned stretch of its staff", () => {
    const staff = LIVE_STAVES[LANDING.staff];
    expect(staff.beams.filter((b) => b.row === 0 && b.start < LANDING.end && LANDING.start < b.end)).toEqual([]);
    for (const into of [0, 0.5, 59 / 60]) expect(stateAt(LANDING, into)).toBe("planned");
  });

  it("splits now into its hour and the fraction gone", () => {
    expect(nowParts(11 * 60 + 30)).toEqual({ hour: 11, into: 0.5 });
    expect(nowParts(0)).toEqual({ hour: 0, into: 0 });
    expect(nowParts(24 * 60 + 15)).toEqual({ hour: 0, into: 0.25 });
  });

  it("writes relative hours as wall-clock minutes across midnight", () => {
    expect(wallMinutesOf(-2.5, 1)).toBe(22 * 60 + 30);
    expect(wallMinutesOf(1.25, 23)).toBe(15);
    expect(wallMinutesOf(0, 11)).toBe(11 * 60);
  });

  it("gives a label the line up to the next beam on its row", () => {
    const work = LIVE_STAVES[0];
    const beam = (title: string) => work.beams.find((b) => b.title === title)!;
    expect(roomAfter(work, beam("Write the quarterly summary"), WIDEST.to)).toBe(2 - -4.5);
    expect(roomAfter(work, beam("Reply to the venue"), WIDEST.to)).toBe(10 - 4);
    expect(roomAfter(work, beam("Send the invoices"), WIDEST.to)).toBe(WIDEST.to - 10);
  });
});
