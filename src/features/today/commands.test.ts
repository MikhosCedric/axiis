import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { captureTask, loadToday, setDone } from "./commands";
import { formatClock, formatDayHeading } from "./format";
import { area, fakeRepo, makeItem } from "./test-support";

describe("captureTask", () => {
  it("creates a trimmed, unscheduled task", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "  Renew passport ")).toEqual({ ok: true });
    expect(calls.create).toEqual([{ type: "task", title: "Renew passport", schedule: { kind: "unscheduled" } }]);
  });

  it("rejects blank, oversized and non-string titles without touching the repo", async () => {
    const { repo, calls } = fakeRepo();
    for (const raw of ["   ", "x".repeat(501), null, 42]) {
      expect((await captureTask(repo, raw)).ok).toBe(false);
    }
    expect(calls.create).toEqual([]);
  });

  it("reports a failed save instead of throwing", async () => {
    const { repo } = fakeRepo();
    repo.create = async () => {
      throw new Error("network");
    };
    const result = await captureTask(repo, "Call the landlord");
    expect(result.ok).toBe(false);
  });
});

describe("setDone", () => {
  it("marks an item done and open again", async () => {
    const item = makeItem();
    const { repo, calls } = fakeRepo([item]);
    expect(await setDone(repo, item.id, true)).toEqual({ ok: true });
    expect(await setDone(repo, item.id, false)).toEqual({ ok: true });
    expect(calls.update).toEqual([
      [item.id, { status: "done" }],
      [item.id, { status: "open" }],
    ]);
  });

  it("refuses an id that is not a uuid", async () => {
    const { repo, calls } = fakeRepo();
    expect((await setDone(repo, "1; drop table items", true)).ok).toBe(false);
    expect(calls.update).toEqual([]);
  });
});

describe("loadToday", () => {
  it("queries the user's local day and builds the view from it", async () => {
    const inRange = makeItem({
      title: "Standup",
      schedule: { kind: "timed", start: new Date("2026-10-06T03:30:00Z"), end: new Date("2026-10-06T04:00:00Z") },
    });
    const yesterday = makeItem({
      title: "Late",
      schedule: { kind: "timed", start: new Date("2026-10-05T18:00:00Z"), end: new Date("2026-10-05T19:00:00Z") },
    });
    const work = area("Work");
    const { repo, calls } = fakeRepo([inRange, yesterday, makeItem({ title: "Someday" })], [work]);

    // 01:00 UTC is already 06:30 on the 6th in Kolkata.
    const today = await loadToday(repo, new Date("2026-10-06T01:00:00Z"), "Asia/Kolkata");

    expect(calls.listForDay).toEqual([
      { date: "2026-10-06", from: new Date("2026-10-05T18:30:00Z"), to: new Date("2026-10-06T18:30:00Z") },
    ]);
    expect(today.date).toBe("2026-10-06");
    expect(today.areas).toEqual([work]);
    expect(today.view.scheduled.map((e) => e.item.title)).toEqual(["Standup"]);
    expect(today.view.waiting.map((e) => e.item.title)).toEqual(["Someday"]);
  });
});

describe("format", () => {
  it("writes the heading for the local date, not the server's", () => {
    expect(formatDayHeading("2026-10-06" as LocalDate)).toBe("Tuesday 6 October");
  });

  it("shows 24-hour clock times in the user's zone", () => {
    const t = new Date("2026-10-06T13:05:00Z");
    expect(formatClock(t, "UTC")).toBe("13:05");
    expect(formatClock(t, "Asia/Kolkata")).toBe("18:35");
    expect(formatClock(new Date("2026-10-06T00:00:00Z"), "UTC")).toBe("00:00");
  });
});
