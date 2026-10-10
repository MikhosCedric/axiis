import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { TAGS_PER_ITEM, TAGS_PER_USER } from "@/domain/tag";
import { captureChecklist, captureTask, setDone } from "./commands";
import { formatClock, formatDayHeading } from "./format";
import { fakeRepo, makeItem } from "./test-support";

// 21:00 on Wednesday 7 October in London, 06:00 on Thursday 8 October in Tokyo.
const NOW = new Date("2026-10-07T20:00:00Z");
const LONDON = "Europe/London";

describe("captureTask", () => {
  it("creates a trimmed, unscheduled task", async () => {
    const { repo, calls, items } = fakeRepo();
    expect(await captureTask(repo, "  Renew passport ", NOW, LONDON)).toEqual({
      ok: true,
      id: items[0].id,
      type: "task",
      title: "Renew passport",
      plan: null,
      tags: [],
      missed: [],
    });
    expect(calls.create).toEqual([{ type: "task", title: "Renew passport", schedule: { kind: "unscheduled" } }]);
  });

  it("plans a timed slot at the default length and tags it, from the words alone", async () => {
    const { repo, calls, items, itemTags, tags } = fakeRepo();
    const result = await captureTask(repo, "dentist tomorrow 9:00 #health", NOW, LONDON);
    expect(result).toEqual({ ok: true, id: items[0].id, type: "task", title: "dentist", plan: "tomorrow, 09:00", tags: ["health"], missed: [] });
    expect(calls.create).toEqual([
      {
        type: "task",
        title: "dentist",
        schedule: { kind: "timed", start: new Date("2026-10-08T08:00:00Z"), end: new Date("2026-10-08T08:30:00Z") },
      },
    ]);
    expect(tags.map((t) => t.name)).toEqual(["health"]);
    expect(itemTags).toEqual([{ itemId: items[0].id, tagId: tags[0].id }]);
  });

  it("plans a day without a time, counting days from the user's own today", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "call bank tomorrow", NOW, "Asia/Tokyo")).toMatchObject({ plan: "tomorrow" });
    expect(calls.create[0].schedule).toEqual({ kind: "day", on: "2026-10-09" });
    await captureTask(repo, "call bank tomorrow", NOW, LONDON);
    expect(calls.create[1].schedule).toEqual({ kind: "day", on: "2026-10-08" });
  });

  it("puts a time with no day on today, and names a typed length's end", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "gym 22:00 for 45m", NOW, LONDON)).toMatchObject({ plan: "today, 22:00 to 22:45" });
    expect(calls.create[0].schedule).toEqual({
      kind: "timed",
      start: new Date("2026-10-07T21:00:00Z"),
      end: new Date("2026-10-07T21:45:00Z"),
    });
  });

  it("builds times from the local clock across a clock change", async () => {
    const { repo, calls } = fakeRepo();
    await captureTask(repo, "night shift 2026-10-25 00:30 for 2h", NOW, LONDON);
    // Clocks go back at 02:00 BST, so two hours of wall clock span three real ones.
    expect(calls.create[0].schedule).toEqual({
      kind: "timed",
      start: new Date("2026-10-24T23:30:00Z"),
      end: new Date("2026-10-25T02:30:00Z"),
    });
  });

  it("keeps the item when a tag does not save, and says which", async () => {
    const { repo, calls } = fakeRepo();
    repo.addTags = async () => {
      throw new Error("network");
    };
    expect(await captureTask(repo, "walk #health", NOW, LONDON)).toMatchObject({ ok: true, tags: [], missed: ["health"] });
    expect(calls.create).toHaveLength(1);
  });

  it("puts every tag of the line on in one write, without reading every tag's open count", async () => {
    const { repo, calls, items, itemTags } = fakeRepo();
    expect(await captureTask(repo, "walk #health #outside", NOW, LONDON)).toMatchObject({
      ok: true,
      tags: ["health", "outside"],
      missed: [],
    });
    expect(calls.addTags).toEqual([[items[0].id, ["health", "outside"]]]);
    expect(itemTags).toHaveLength(2);
    expect(calls.listTags).toBe(0);
  });

  it("misses the tags past the item's limit and new ones past the user's", async () => {
    const full = fakeRepo([makeItem()]);
    full.tag(full.items[0].id, ...Array.from({ length: TAGS_PER_USER - 1 }, (_, i) => `t${i}`));
    const many = Array.from({ length: TAGS_PER_ITEM + 1 }, (_, i) => `#n${i}`).join(" ");
    const result = await captureTask(full.repo, `walk #t0 ${many}`, NOW, LONDON);
    // t0 exists, n0 takes the one free slot, and the item's limit stops the rest.
    expect(result).toMatchObject({ ok: true, tags: ["t0", "n0"] });
    expect(result.ok && result.missed).toHaveLength(TAGS_PER_ITEM);
  });

  it("captures a checklist under its name as typed, unplanned, naming the new one", async () => {
    const { repo, calls, items, tags } = fakeRepo();
    expect(await captureChecklist(repo, " Pack for the coast ")).toMatchObject({ ok: true, id: items[0].id, type: "checklist" });
    expect(await captureChecklist(repo, "Groceries for Sunday 9:00 #home")).toEqual({
      ok: true,
      id: items[1].id,
      type: "checklist",
      title: "Groceries for Sunday 9:00 #home",
      plan: null,
      tags: [],
      missed: [],
    });
    expect(calls.create).toEqual([
      { type: "checklist", title: "Pack for the coast", schedule: { kind: "unscheduled" } },
      { type: "checklist", title: "Groceries for Sunday 9:00 #home", schedule: { kind: "unscheduled" } },
    ]);
    expect(tags).toEqual([]);
    expect(await captureChecklist(repo, "  ")).toMatchObject({ ok: false });
    expect(calls.create).toHaveLength(2);
  });

  it("rejects blank, oversized and non-string titles without touching the repo", async () => {
    const { repo, calls } = fakeRepo();
    for (const raw of ["   ", "x".repeat(501), null, 42]) {
      expect((await captureTask(repo, raw, NOW, LONDON)).ok).toBe(false);
    }
    expect(calls.create).toEqual([]);
  });

  it("reports a failed save instead of throwing", async () => {
    const { repo, calls } = fakeRepo();
    repo.create = async () => {
      throw new Error("network");
    };
    const result = await captureTask(repo, "Call the landlord #home", NOW, LONDON);
    expect(result.ok).toBe(false);
    expect(calls.addTags).toEqual([]);
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
