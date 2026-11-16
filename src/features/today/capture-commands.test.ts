import { describe, expect, it } from "vitest";
import type { CaptureArea } from "./capture-syntax";
import { captureLines, captureList, captureTask } from "./commands";
import { pastedLines, shortName } from "./capture-paste";
import { fakeRepo } from "./test-support";

// 21:00 on Wednesday 7 October in London.
const NOW = new Date("2026-10-07T20:00:00Z");
const LONDON = "Europe/London";
const WORK: CaptureArea = { id: "area-work" as CaptureArea["id"], name: "Work" };

describe("captureTask with the new phrases", () => {
  it("plans 'next week' on the first day of the user's week", async () => {
    const monday = fakeRepo();
    expect(await captureTask(monday.repo, "plan next week", NOW, LONDON)).toMatchObject({ ok: true, landed: { on: "2026-10-12" } });
    const sunday = fakeRepo();
    expect(await captureTask(sunday.repo, "plan next week", NOW, LONDON, null, undefined, 0)).toMatchObject({ ok: true, landed: { on: "2026-10-11" } });
  });

  it("plans 'in 2 hours' at the next quarter hour, tomorrow when it passes midnight", async () => {
    const soon = fakeRepo();
    const r = await captureTask(soon.repo, "call Sam in 3 hours", NOW, LONDON);
    expect(r).toMatchObject({ ok: true, title: "call Sam", landed: { on: "2026-10-08", day: "tomorrow", time: { start: 0, end: null } } });
    expect(soon.calls.create[0].schedule).toMatchObject({ kind: "timed", start: new Date("2026-10-07T23:00:00Z") });
  });

  it("stores a due date apart from the planned day, and the area it matched", async () => {
    const { repo, calls } = fakeRepo();
    const r = await captureTask(repo, "write report tomorrow due friday @work", NOW, LONDON, null, undefined, undefined, [WORK]);
    expect(r).toMatchObject({ ok: true, title: "write report", area: "Work" });
    expect(calls.create[0]).toMatchObject({ schedule: { kind: "day", on: "2026-10-08" }, dueOn: "2026-10-09", areaId: "area-work" });
  });

  it("a due date alone leaves the task in the Inbox", async () => {
    const { repo, calls } = fakeRepo();
    await captureTask(repo, "write report due friday", NOW, LONDON);
    expect(calls.create[0]).toMatchObject({ schedule: { kind: "unscheduled" }, dueOn: "2026-10-09" });
  });

  it("keeps an unknown @name in the title and sets no area", async () => {
    const { repo, calls } = fakeRepo();
    const r = await captureTask(repo, "file expenses @home", NOW, LONDON, null, undefined, undefined, [WORK]);
    expect(r).toMatchObject({ ok: true, title: "file expenses @home" });
    expect(calls.create[0]).not.toHaveProperty("areaId");
  });
});

describe("a pasted block", () => {
  it("drops list markers and blank lines, and leaves one line alone", () => {
    expect(pastedLines("- milk\n\n2. eggs\r\n[ ] bread")).toEqual(["milk", "eggs", "bread"]);
    expect(pastedLines("just one line")).toBeNull();
    expect(pastedLines("a\nb\n".repeat(20))).toBeNull();
  });
  it("shortens a long name on a word", () => {
    expect(shortName("Pack the car for the long drive to the coast")).toBe("Pack the car for the long…");
  });
  it("captureLines reads each line as a typed capture", async () => {
    const { repo, calls } = fakeRepo();
    const r = await captureLines(repo, ["call mum tomorrow", "buy milk"], NOW, LONDON);
    expect(r).toMatchObject({ ok: true, count: 2 });
    expect(calls.create.map((c) => c.title)).toEqual(["call mum", "buy milk"]);
  });
  it("captureList makes a checklist named by the first line", async () => {
    const { repo, calls } = fakeRepo();
    const r = await captureList(repo, ["Shopping", "milk", "eggs"]);
    expect(r).toMatchObject({ ok: true, type: "checklist", title: "Shopping", count: 2 });
    expect(calls.create.map((c) => [c.type, c.title])).toEqual([["checklist", "Shopping"], ["task", "milk"], ["task", "eggs"]]);
  });
  it("refuses one line or too many", async () => {
    const { repo } = fakeRepo();
    expect(await captureList(repo, ["only"])).toMatchObject({ ok: false });
    expect(await captureLines(repo, Array(31).fill("x"), NOW, LONDON)).toMatchObject({ ok: false });
  });
});
