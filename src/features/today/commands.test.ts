import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { captureChecklist, captureTask, setDone } from "./commands";
import { formatClock, formatDayHeading } from "./format";
import { fakeRepo, makeItem } from "./test-support";

describe("captureTask", () => {
  it("creates a trimmed, unscheduled task", async () => {
    const { repo, calls, items } = fakeRepo();
    expect(await captureTask(repo, "  Renew passport ")).toEqual({ ok: true, id: items[0].id, type: "task" });
    expect(calls.create).toEqual([{ type: "task", title: "Renew passport", schedule: { kind: "unscheduled" } }]);
  });

  it("captures a checklist the same way, naming the new one", async () => {
    const { repo, calls, items } = fakeRepo();
    expect(await captureChecklist(repo, " Pack for the coast ")).toEqual({ ok: true, id: items[0].id, type: "checklist" });
    expect(calls.create).toEqual([{ type: "checklist", title: "Pack for the coast", schedule: { kind: "unscheduled" } }]);
    expect(await captureChecklist(repo, "  ")).toMatchObject({ ok: false });
    expect(calls.create).toHaveLength(1);
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
    expect(await setDone(repo, item.id, true, "UTC")).toEqual({ ok: true });
    expect(await setDone(repo, item.id, false, "UTC")).toEqual({ ok: true });
    expect(calls.update).toEqual([
      [item.id, { status: "done" }],
      [item.id, { status: "open" }],
    ]);
  });

  it("refuses an id that is not a uuid", async () => {
    const { repo, calls } = fakeRepo();
    expect((await setDone(repo, "1; drop table items", true, "UTC")).ok).toBe(false);
    expect(calls.update).toEqual([]);
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
