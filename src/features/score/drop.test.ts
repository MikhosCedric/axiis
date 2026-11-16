import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { area, makeItem } from "@/features/today/test-support";
import { instantAt } from "@/lib/dates";
import { changes } from "./drop";
import { clamp, snap } from "./snap";

const date = "2026-10-06" as LocalDate;
const zone = "America/New_York";
const at = (minutes: number) => instantAt(date, minutes, zone);

describe("snap", () => {
  it("rounds to the nearest quarter hour, halfway going later", () => {
    expect([snap(607), snap(608), snap(600), snap(-8)]).toEqual([600, 615, 600, -15]);
  });

  it("clamps, with the lower bound winning when the range is empty", () => {
    expect([clamp(5, 0, 10), clamp(-1, 0, 10), clamp(11, 0, 10), clamp(5, 8, 2)]).toEqual([5, 0, 10, 8]);
  });
});

describe("changes", () => {
  it("is false for a drop back where the item already was", () => {
    const item = makeItem({ schedule: { kind: "timed", start: at(600), end: at(660) } });
    expect(changes(item, { schedule: { kind: "timed", start: at(600), end: at(660) } })).toBe(false);
    expect(changes(item, { schedule: { kind: "timed", start: at(600), end: at(675) } })).toBe(true);
    expect(changes(item, { schedule: item.schedule, areaId: area("Work").id })).toBe(true);
    expect(changes(makeItem(), { schedule: { kind: "unscheduled" } })).toBe(false);
    expect(changes(makeItem(), { schedule: { kind: "day", on: date } })).toBe(true);
    expect(changes(makeItem({ schedule: { kind: "day", on: date } }), { schedule: { kind: "day", on: date } })).toBe(false);
  });
});
