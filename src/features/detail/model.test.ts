import { describe, expect, it } from "vitest";
import { ITEM_TYPES, type ItemId, type LocalDate } from "@/domain/item";
import { area, makeItem } from "@/features/today/test-support";
import { buildDetail, clockOf, describeWhen, minutesOf, planOptions, progressLine, subtaskPolicy, timeFrom } from "./model";

describe("timeFrom", () => {
  it("reads a start and an end as minutes and a length", () => {
    expect(timeFrom("14:00", "15:30")).toEqual({ start: 840, length: 90 });
    expect(clockOf(840 + 90)).toBe("15:30");
  });

  it("runs past midnight when the end is not after the start", () => {
    expect(timeFrom("23:00", "01:00")).toEqual({ start: 1380, length: 120 });
    expect(timeFrom("09:00", "09:00")).toEqual({ start: 540, length: 1440 });
    expect(clockOf(1380 + 120)).toBe("01:00");
  });

  it("gives a start with no end the default length, and nothing without a start", () => {
    expect(timeFrom("07:15", "")).toEqual({ start: 435, length: 30 });
    expect(timeFrom("", "10:00")).toBeNull();
    expect(timeFrom("24:00", "")).toBeNull();
  });

  it("refuses an end it cannot read rather than guessing a length", () => {
    expect(timeFrom("07:15", "7pm")).toBeNull();
    expect(timeFrom("07:15", "25:00")).toBeNull();
  });
});

describe("minutesOf", () => {
  it.each([
    ["14:30", 870],
    ["14.30", 870],
    ["1430", 870],
    ["0930", 570],
    ["930", 570],
    ["9", 540],
    [" 23:59 ", 1439],
    ["00:00", 0],
  ])("reads %s as a 24-hour clock", (raw, minutes) => {
    expect(minutesOf(raw)).toBe(minutes);
  });

  it.each(["", "24:00", "12:60", "2:5", "9am", "12345", "-1:00", "1:2:3"])("refuses %j", (raw) => {
    expect(minutesOf(raw)).toBeNull();
  });
});

const parentId = "00000000-0000-4000-8000-0000000000aa" as ItemId;
const NONE = { kind: "none" } as const;

describe("subtaskPolicy", () => {
  it.each([
    ["task", null, { kind: "holds-subtasks" }],
    ["checklist", null, { kind: "holds-subtasks" }],
    ["note", null, { kind: "no-subtasks" }],
    ["event", null, { kind: "no-subtasks" }],
    ["task", parentId, { kind: "is-subtask", parentId }],
    ["checklist", parentId, { kind: "is-subtask", parentId }],
    ["note", parentId, { kind: "is-subtask", parentId }],
    ["event", parentId, { kind: "is-subtask", parentId }],
  ] as const)("%s with parent %s", (type, parent, expected) => {
    expect(subtaskPolicy({ type, parentId: parent, recurrence: NONE })).toEqual(expected);
  });

  it("never lets a subtask hold subtasks of its own", () => {
    for (const type of ITEM_TYPES) {
      expect(subtaskPolicy({ type, parentId, recurrence: NONE }).kind).not.toBe("holds-subtasks");
    }
  });
});

describe("buildDetail", () => {
  const base = { areas: [], subtasks: [], parent: null, timeZone: "UTC", today: "2026-10-06" as LocalDate };

  it("lists subtasks only for an item that may hold them", () => {
    const child = makeItem({ title: "Pack charger", status: "done" });
    const task = buildDetail({ ...base, item: makeItem({ type: "task" }), subtasks: [child] });
    expect(task.nesting).toEqual({ kind: "holds-subtasks", subtasks: [{ id: child.id, title: "Pack charger", done: true }] });

    for (const type of ["note", "event"] as const) {
      expect(buildDetail({ ...base, item: makeItem({ type }), subtasks: [child] }).nesting).toEqual({ kind: "no-subtasks" });
    }
  });

  it("points a subtask at its parent and offers no list of its own", () => {
    const parent = makeItem({ title: "Trip" });
    const view = buildDetail({ ...base, item: makeItem({ parentId: parent.id }), parent, subtasks: [makeItem()] });
    expect(view.nesting).toEqual({ kind: "is-subtask", parent: { id: parent.id, title: "Trip" } });
  });

  it("keeps the parent link quiet when the parent is gone", () => {
    const view = buildDetail({ ...base, item: makeItem({ parentId }) });
    expect(view.nesting).toEqual({ kind: "is-subtask", parent: null });
  });

  it("gives notes no time, and carries area, done and areas through", () => {
    const work = area("Work");
    const note = buildDetail({ ...base, item: makeItem({ type: "note" }) });
    expect(note.when).toBeNull();

    const done = buildDetail({ ...base, areas: [work], item: makeItem({ status: "done", areaId: work.id }) });
    expect(done.item.done).toBe(true);
    expect(done.item.areaId).toBe(work.id);
    expect(done.areas).toEqual([{ id: work.id, name: "Work" }]);
    expect(done.when).toBe("Waiting for a time");
  });
});

describe("describeWhen", () => {
  it("names an unscheduled item and a day-only plan", () => {
    expect(describeWhen({ kind: "unscheduled" }, "UTC")).toBe("Waiting for a time");
    expect(describeWhen({ kind: "day", on: "2026-10-06" as LocalDate }, "UTC")).toBe("Tuesday 6 October");
  });

  it("formats a timed plan in the user's zone, not the server's", () => {
    const schedule = {
      kind: "timed" as const,
      start: new Date("2026-10-06T03:30:00Z"),
      end: new Date("2026-10-06T04:00:00Z"),
    };
    expect(describeWhen(schedule, "UTC")).toBe("Tuesday 6 October, 03:30 to 04:00");
    expect(describeWhen(schedule, "Asia/Kolkata")).toBe("Tuesday 6 October, 09:00 to 09:30");
  });

  it("names the end day when a plan runs past midnight", () => {
    const schedule = {
      kind: "timed" as const,
      start: new Date("2026-10-06T22:00:00Z"),
      end: new Date("2026-10-07T01:00:00Z"),
    };
    expect(describeWhen(schedule, "UTC")).toBe("Tuesday 6 October, 22:00 to Wednesday 7 October, 01:00");
  });
});

describe("due", () => {
  const base = { areas: [], subtasks: [], parent: null, timeZone: "UTC", today: "2026-10-06" as LocalDate };
  const daily = { freq: "daily", interval: 1, end: { kind: "never" } } as const;

  it("lets a one-off task or checklist set its due date, and nothing else", () => {
    const due = "2026-10-09" as LocalDate;
    expect(buildDetail({ ...base, item: makeItem({ dueOn: due }) }).due).toEqual({ on: due, editable: true });
    expect(buildDetail({ ...base, item: makeItem({ type: "checklist" }) }).due).toEqual({ on: null, editable: true });
    for (const item of [
      makeItem({ type: "event", dueOn: due }),
      makeItem({ type: "note" }),
      makeItem({ schedule: { kind: "day", on: due }, recurrence: { kind: "series", rule: daily } }),
    ]) {
      expect(buildDetail({ ...base, item }).due.editable).toBe(false);
    }
  });
});

describe("progressLine", () => {
  it("counts done subtasks, and says nothing when there are none", () => {
    expect(progressLine([])).toBeNull();
    expect(progressLine([{ done: true }, { done: false }, { done: true }])).toBe("2 of 3 done");
  });
});

describe("retype", () => {
  const base = { areas: [], subtasks: [], parent: null, timeZone: "UTC", today: "2026-10-06" as LocalDate };

  it("offers a type choice to a top-level task, event or checklist, never to a note or a subtask", () => {
    for (const type of ["task", "event", "checklist"] as const) {
      expect(buildDetail({ ...base, item: makeItem({ type }) }).retype).toBe(true);
    }
    expect(buildDetail({ ...base, item: makeItem({ type: "note" }) }).retype).toBe(false);
    expect(buildDetail({ ...base, item: makeItem({ parentId }) }).retype).toBe(false);
  });
});

describe("planOptions", () => {
  const base = { areas: [], subtasks: [], parent: null, timeZone: "UTC", today: "2026-10-06" as LocalDate };
  const daily = { freq: "daily", interval: 1, end: { kind: "never" } } as const;

  it("lets a one-off item go to any day, and off it or timed only once it has one", () => {
    const waiting = buildDetail({ ...base, item: makeItem() });
    expect(waiting.day).toBeNull();
    expect(waiting.today).toBe("2026-10-06");
    expect(planOptions(waiting, "one")).toEqual({ days: true, unplan: false, time: false, firstDay: false });

    const planned = buildDetail({ ...base, item: makeItem({ type: "event", schedule: { kind: "day", on: "2026-10-08" as LocalDate } }) });
    expect(planned.day).toBe("2026-10-08");
    expect(planOptions(planned, "one")).toEqual({ days: true, unplan: true, time: true, firstDay: false });
  });

  it("offers a note nothing", () => {
    expect(planOptions(buildDetail({ ...base, item: makeItem({ type: "note" }) }), "one")).toEqual({
      days: false,
      unplan: false,
      time: false,
      firstDay: false,
    });
  });

  it("keeps a series on its First day, and moves one occurrence only with This one, never off its day", () => {
    const series = makeItem({ schedule: { kind: "day", on: "2026-10-05" as LocalDate }, recurrence: { kind: "series", rule: daily } });
    expect(planOptions(buildDetail({ ...base, item: series }), "one")).toEqual({ days: false, unplan: false, time: true, firstDay: true });

    const override = makeItem({
      schedule: { kind: "day", on: "2026-10-07" as LocalDate },
      recurrence: { kind: "override", seriesId: series.id, originalOn: "2026-10-07" as LocalDate },
    });
    const view = buildDetail({ ...base, item: override, series });
    expect(planOptions(view, "one")).toEqual({ days: true, unplan: false, time: true, firstDay: false });
    expect(planOptions(view, "all")).toEqual({ days: false, unplan: false, time: true, firstDay: true });

    // Once its series is gone it is an ordinary item.
    expect(planOptions(buildDetail({ ...base, item: override, series: null }), "one").unplan).toBe(true);
  });
});
