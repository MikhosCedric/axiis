import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate, ShownItem } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { makeItem } from "@/features/today/test-support";
import { instantAt } from "@/lib/dates";
import { seriesTimeOffer } from "./series-time";

const date = "2026-10-06" as LocalDate;
const seriesId = "00000000-0000-4000-8000-0000000000aa" as ItemId;
const cadences = { [seriesId]: "every day" };
const at = (minutes: number, tz = "UTC") => instantAt(date, minutes, tz);
const timed = (start: number, end: number, tz = "UTC") => ({ schedule: { kind: "timed" as const, start: at(start, tz), end: at(end, tz) } });

const occurrence = (over: Partial<ShownItem> = {}): ShownItem => ({
  ...makeItem({ title: "Test 1", schedule: { kind: "day", on: date } }),
  id: occurrenceKey(seriesId, date),
  recurrence: { kind: "occurrence", seriesId, originalOn: date },
  ...over,
} as ShownItem);

describe("seriesTimeOffer", () => {
  it("offers the new time, as local minutes and a length, for an occurrence placed on a staff", () => {
    expect(seriesTimeOffer(occurrence(), timed(14 * 60, 15 * 60), date, "UTC", cadences)).toEqual({
      id: occurrenceKey(seriesId, date),
      title: "Test 1",
      time: { start: 14 * 60, length: 60 },
      cadence: "every day",
    });
  });

  it("reads the wall clock in the user's zone", () => {
    const tz = "Asia/Manila";
    expect(seriesTimeOffer(occurrence(), timed(9 * 60, 9 * 60 + 30, tz), date, tz, cadences)?.time).toEqual({ start: 540, length: 30 });
  });

  it("offers it for an override too", () => {
    const override = occurrence({ id: "00000000-0000-4000-8000-0000000000bb" as ItemId, recurrence: { kind: "override", seriesId, originalOn: date } });
    expect(seriesTimeOffer(override, timed(600, 630), date, "UTC", cadences)?.id).toBe(override.id);
  });

  it("offers nothing when the time did not change, the item left the staves, or it does not repeat", () => {
    const placed = occurrence(timed(600, 630));
    expect(seriesTimeOffer(placed, { ...timed(600, 630), areaId: null }, date, "UTC", cadences)).toBeNull();
    expect(seriesTimeOffer(occurrence(), { schedule: { kind: "day", on: date } }, date, "UTC", cadences)).toBeNull();
    expect(seriesTimeOffer(occurrence(), { schedule: { kind: "unscheduled" } }, date, "UTC", cadences)).toBeNull();
    expect(seriesTimeOffer(makeItem({ title: "Plain" }), timed(600, 630), date, "UTC", cadences)).toBeNull();
  });

  it("offers nothing for a series that is gone, or a start past midnight", () => {
    expect(seriesTimeOffer(occurrence(), timed(600, 630), date, "UTC", {})).toBeNull();
    expect(seriesTimeOffer(occurrence(), timed(24 * 60 + 30, 25 * 60), date, "UTC", cadences)).toBeNull();
  });
});
