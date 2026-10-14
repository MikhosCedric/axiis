import { describe, expect, it } from "vitest";
import type { ItemId, LocalDate, NewItem, Schedule } from "@/domain/item";
import type { Rule } from "@/domain/recurrence";
import {
  InvalidScheduleError,
  LIST_COLUMNS,
  areaFromRow,
  itemFromRow,
  newItemToInsert,
  patchToUpdate,
  scheduleToColumns,
} from "./mappers";

const ID = "6f1c2a9e-4b7d-4c8e-9a1f-2d3e4f5a6b7c";
const AREA_ID = "0b6e1c5d-2f3a-4e8b-8c7d-1a2b3c4d5e6f";
const day = (s: string) => s as LocalDate;
const weeklyOnMonday: Rule = { freq: "weekly", interval: 1, byDay: ["MO"], end: { kind: "never" } };

/** Postgres renders timestamptz as `+00:00` with microseconds, not JavaScript's `Z`. */
const pg = (iso: string | null) => (iso === null ? null : iso.replace(/\.(\d{3})Z$/, ".$1000+00:00"));

function storedRow(insert: ReturnType<typeof newItemToInsert>) {
  return {
    id: ID,
    status: "open",
    position: 0,
    completed_at: null,
    created_at: "2026-10-06T08:00:00.123456+00:00",
    updated_at: "2026-10-06T08:00:00+00:00",
    ...insert,
    start_at: pg(insert.start_at),
    end_at: pg(insert.end_at),
  };
}

const validRow = {
  id: ID,
  type: "task",
  title: "Write the brief",
  body: null,
  status: "open",
  area_id: null,
  parent_id: null,
  position: 1.5,
  start_at: null,
  end_at: null,
  scheduled_on: null,
  due_on: null,
  rrule: null,
  series_id: null,
  original_on: null,
  completed_at: null,
  created_at: "2026-10-06T08:00:00+00:00",
  updated_at: "2026-10-06T08:00:00+00:00",
};

describe("schedule round trip", () => {
  const schedules: Schedule[] = [
    { kind: "unscheduled" },
    { kind: "day", on: day("2026-10-06") },
    { kind: "timed", start: new Date("2026-10-06T09:00:00.000Z"), end: new Date("2026-10-06T09:30:00.000Z") },
  ];

  it.each(schedules)("keeps a $kind schedule through insert and read", (schedule) => {
    const input: NewItem = {
      type: "event",
      title: "Standup",
      body: { type: "doc", content: [] },
      areaId: AREA_ID as NewItem["areaId"],
      schedule,
      dueOn: day("2026-10-09"),
      recurrence: { kind: "series", rule: weeklyOnMonday },
    };
    const item = itemFromRow(storedRow(newItemToInsert(input)));
    expect(item.schedule).toEqual(schedule);
    expect(item).toMatchObject({
      id: ID,
      type: "event",
      title: "Standup",
      body: { type: "doc", content: [] },
      areaId: AREA_ID,
      parentId: null,
      dueOn: "2026-10-09",
      recurrence: { kind: "series", rule: weeklyOnMonday },
      completedAt: null,
    });
    expect(item.createdAt).toEqual(new Date("2026-10-06T08:00:00.123Z"));
  });

  it("writes exactly one schedule shape to the columns", () => {
    expect(scheduleToColumns({ kind: "unscheduled" })).toEqual({ start_at: null, end_at: null, scheduled_on: null });
    expect(scheduleToColumns({ kind: "day", on: day("2026-10-06") })).toEqual({
      start_at: null,
      end_at: null,
      scheduled_on: "2026-10-06",
    });
    expect(
      scheduleToColumns({
        kind: "timed",
        start: new Date("2026-10-06T09:00:00.000Z"),
        end: new Date("2026-10-06T10:00:00.000Z"),
      }),
    ).toEqual({ start_at: "2026-10-06T09:00:00.000Z", end_at: "2026-10-06T10:00:00.000Z", scheduled_on: null });
  });

  it("defaults a new item to unscheduled", () => {
    expect(newItemToInsert({ type: "note", title: "" })).toEqual({
      type: "note",
      title: "",
      body: null,
      area_id: null,
      parent_id: null,
      start_at: null,
      end_at: null,
      scheduled_on: null,
      due_on: null,
      rrule: null,
      series_id: null,
      original_on: null,
    });
  });

  it("refuses to write a timed schedule that ends before it starts", () => {
    const start = new Date("2026-10-06T10:00:00Z");
    expect(() => scheduleToColumns({ kind: "timed", start, end: start })).toThrow(InvalidScheduleError);
  });
});

describe("itemFromRow rejects illegal rows", () => {
  it.each([
    [
      "timed and day-only at once",
      { start_at: "2026-10-06T09:00:00+00:00", end_at: "2026-10-06T10:00:00+00:00", scheduled_on: "2026-10-06" },
      /both timed .* and day-only/,
    ],
    ["start without end", { start_at: "2026-10-06T09:00:00+00:00" }, /only one of start_at and end_at/],
    ["end without start", { end_at: "2026-10-06T09:00:00+00:00" }, /only one of start_at and end_at/],
    [
      "end before start",
      { start_at: "2026-10-06T10:00:00+00:00", end_at: "2026-10-06T09:00:00+00:00" },
      /at or before it starts/,
    ],
  ])("%s", (_, override, message) => {
    expect(() => itemFromRow({ ...validRow, ...override })).toThrow(message);
  });

  it.each([
    ["a non-uuid id", { id: "42" }],
    ["an unknown type", { type: "habit" }],
    ["an unknown status", { status: "archived" }],
    ["a malformed date", { scheduled_on: "06/10/2026" }],
    ["a timestamp without offset", { created_at: "2026-10-06 08:00:00" }],
    ["a missing column", { title: undefined }],
  ])("%s", (_, override) => {
    expect(() => itemFromRow({ ...validRow, ...override })).toThrow();
  });

  it("reads the valid baseline row", () => {
    expect(itemFromRow(validRow).schedule).toEqual({ kind: "unscheduled" });
    expect(itemFromRow(validRow).recurrence).toEqual({ kind: "none" });
  });

  it("reads a list row, which has no body column, as an item with no body", () => {
    const listRow = Object.fromEntries(LIST_COLUMNS.split(",").map((c) => [c, validRow[c as keyof typeof validRow]]));
    expect("body" in listRow).toBe(false);
    expect(itemFromRow(listRow).body).toBeNull();
  });
});

describe("recurrence columns", () => {
  const SERIES = "0b6e1c5d-2f3a-4e8b-8c7d-000000000001" as ItemId;

  it("round-trips an override", () => {
    const recurrence = { kind: "override", seriesId: SERIES, originalOn: day("2026-10-08") } as const;
    const insert = newItemToInsert({ type: "task", title: "Standup", schedule: { kind: "day", on: day("2026-10-09") }, recurrence });
    expect(insert).toMatchObject({ rrule: null, series_id: SERIES, original_on: "2026-10-08" });
    expect(itemFromRow(storedRow(insert)).recurrence).toEqual(recurrence);
  });

  it("writes a series rule in canonical form", () => {
    expect(patchToUpdate({ recurrence: { kind: "series", rule: weeklyOnMonday } }, new Date())).toEqual({
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      series_id: null,
      original_on: null,
    });
  });

  it.each([
    ["a rule outside the allowlist", { rrule: "FREQ=DAILY;BYHOUR=9", scheduled_on: "2026-10-06" }, /outside the allowlist/],
    ["a rule on an override", { rrule: "FREQ=DAILY", series_id: SERIES, original_on: "2026-10-06" }, /both repeats and replaces/],
    ["series_id alone", { series_id: SERIES }, /only one of series_id and original_on/],
    ["original_on alone", { original_on: "2026-10-06" }, /only one of series_id and original_on/],
  ])("rejects %s", (_, override, message) => {
    expect(() => itemFromRow({ ...validRow, ...override })).toThrow(message);
  });
});

describe("patchToUpdate", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("leaves out every key the patch does not mention", () => {
    expect(patchToUpdate({}, now)).toEqual({});
    expect(patchToUpdate({ title: "Renamed" }, now)).toEqual({ title: "Renamed" });
    expect(patchToUpdate({ type: "event" }, now)).toEqual({ type: "event" });
  });

  it("passes explicit nulls through so fields can be cleared", () => {
    expect(patchToUpdate({ areaId: null, parentId: null, dueOn: null, recurrence: { kind: "none" }, body: null }, now)).toEqual({
      area_id: null,
      parent_id: null,
      due_on: null,
      rrule: null,
      series_id: null,
      original_on: null,
      body: null,
    });
  });

  it("rewrites all three schedule columns when the schedule changes", () => {
    expect(patchToUpdate({ schedule: { kind: "day", on: day("2026-10-07") } }, now)).toEqual({
      start_at: null,
      end_at: null,
      scheduled_on: "2026-10-07",
    });
  });

  it("stamps completed_at when an item is done and clears it otherwise", () => {
    expect(patchToUpdate({ status: "done" }, now)).toEqual({ status: "done", completed_at: "2026-10-06T12:00:00.000Z" });
    expect(patchToUpdate({ status: "open" }, now)).toEqual({ status: "open", completed_at: null });
    expect(patchToUpdate({ status: "dropped" }, now)).toEqual({ status: "dropped", completed_at: null });
  });
});

describe("areaFromRow", () => {
  it("parses an area and rejects a bad id", () => {
    expect(areaFromRow({ id: AREA_ID, name: "Work", position: 1 })).toEqual({ id: AREA_ID, name: "Work", position: 1 });
    expect(() => areaFromRow({ id: "nope", name: "Work", position: 1 })).toThrow();
  });
});
