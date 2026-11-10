import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { TAGS_PER_ITEM, TAGS_PER_USER } from "@/domain/tag";
import { QUOTA_MESSAGE } from "@/lib/quota";
import { captureChecklist, captureTask, setDone } from "./commands";
import { formatDayHeading } from "./format";
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
      landed: null,
      tags: [],
      missed: [],
    });
    expect(calls.create).toEqual([{ type: "task", title: "Renew passport", schedule: { kind: "unscheduled" } }]);
  });

  it("plans a timed slot at the default length and tags it, from the words alone", async () => {
    const { repo, calls, items, itemTags, tags } = fakeRepo();
    const result = await captureTask(repo, "dentist tomorrow 9:00 #health", NOW, LONDON);
    expect(result).toEqual({ ok: true, id: items[0].id, type: "task", title: "dentist", landed: { on: "2026-10-08", day: "tomorrow", time: { start: 540, end: null } }, tags: ["health"], missed: [] });
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
    expect(await captureTask(repo, "call bank tomorrow", NOW, "Asia/Tokyo")).toMatchObject({ landed: { on: "2026-10-09", day: "tomorrow", time: null } });
    expect(calls.create[0].schedule).toEqual({ kind: "day", on: "2026-10-09" });
    await captureTask(repo, "call bank tomorrow", NOW, LONDON);
    expect(calls.create[1].schedule).toEqual({ kind: "day", on: "2026-10-08" });
  });

  it("lands a line that names no day on the default day, and lets a named day win", async () => {
    const { repo, calls } = fakeRepo();
    const on = "2026-11-20" as LocalDate;
    await captureTask(repo, "dentist", NOW, LONDON, on);
    await captureTask(repo, "dentist 9:00", NOW, LONDON, on);
    await captureTask(repo, "dentist tomorrow", NOW, LONDON, on);
    expect(calls.create.map((c) => c.schedule)).toEqual([
      { kind: "day", on: "2026-11-20" },
      { kind: "timed", start: new Date("2026-11-20T09:00:00Z"), end: new Date("2026-11-20T09:30:00Z") },
      { kind: "day", on: "2026-10-08" },
    ]);
  });

  it("puts a time with no day on today, and names a typed length's end", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "gym 22:00 for 45m", NOW, LONDON)).toMatchObject({ landed: { on: "2026-10-07", day: "today", time: { start: 1320, end: 1365 } } });
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
      landed: null,
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

  it("says the account is full when the database refuses on a quota", async () => {
    const { repo } = fakeRepo();
    repo.create = async () => {
      throw new Error("items.create failed", { cause: { code: "54000", message: "quota exceeded" } });
    };
    expect(await captureTask(repo, "Call the landlord", NOW, LONDON)).toEqual({ ok: false, error: QUOTA_MESSAGE });
    expect(await captureChecklist(repo, "Pack")).toEqual({ ok: false, error: QUOTA_MESSAGE });
  });
});

describe("captureTask with a repeat", () => {
  it("makes a weekly series in one step from the owner's line, on the next Tuesday", async () => {
    const { repo, calls, items } = fakeRepo();
    expect(await captureTask(repo, "every tuesday at 7:30am to 9am gym", NOW, LONDON)).toEqual({
      ok: true,
      id: items[0].id,
      type: "task",
      title: "gym",
      landed: { on: "2026-10-13", day: "Tuesday 13 October", time: { start: 450, end: 540 }, repeats: "every Tuesday" },
      tags: [],
      missed: [],
    });
    expect(calls.create).toEqual([
      {
        type: "task",
        title: "gym",
        schedule: { kind: "timed", start: new Date("2026-10-13T06:30:00Z"), end: new Date("2026-10-13T08:00:00Z") },
        recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } },
      },
    ]);
    expect(items[0].recurrence).toEqual({ kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } });
  });

  it("starts today when today is one of its days and its time is ahead, and keeps several weekdays", async () => {
    const { repo, calls } = fakeRepo();
    // NOW is 21:00 on a Wednesday in London: 22:00 is still ahead, so the series starts today.
    const result = await captureTask(repo, "swim mon/wed/fri 22:00", NOW, LONDON);
    expect(result).toMatchObject({ landed: { on: "2026-10-07", day: "today", repeats: "every Monday, Wednesday and Friday" } });
    expect(calls.create[0].recurrence).toEqual({ kind: "series", rule: { freq: "weekly", interval: 1, byDay: ["MO", "WE", "FR"], end: { kind: "never" } } });
  });

  it("starts on the next of its days when its time today has passed, unless today was typed or no time was", async () => {
    const { repo } = fakeRepo();
    // 08:00 has passed at 21:00 on Wednesday, so the first swim is Friday's.
    expect(await captureTask(repo, "swim mon/wed/fri 8:00", NOW, LONDON)).toMatchObject({ landed: { on: "2026-10-09", day: "Friday 9 October" } });
    expect(await captureTask(repo, "pills every day 8:00", NOW, LONDON)).toMatchObject({ landed: { on: "2026-10-08", day: "tomorrow" } });
    expect(await captureTask(repo, "pills every day starting today 8:00", NOW, LONDON)).toMatchObject({ landed: { on: "2026-10-07", day: "today" } });
    expect(await captureTask(repo, "swim mon/wed/fri", NOW, LONDON)).toMatchObject({ landed: { on: "2026-10-07", day: "today" } });
  });

  it("builds the first start from the local clock on the day the clocks change", async () => {
    const { repo, calls } = fakeRepo();
    // London leaves summer time early on Sunday 25 October 2026.
    await captureTask(repo, "run every sunday 9:00 for 1h", new Date("2026-10-20T12:00:00Z"), LONDON);
    expect(calls.create[0].schedule).toEqual({ kind: "timed", start: new Date("2026-10-25T09:00:00Z"), end: new Date("2026-10-25T10:00:00Z") });
  });

  it("plans a repeat with no time on its first day, from a named day or the default day", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "pills every day starting tomorrow", NOW, LONDON)).toMatchObject({
      landed: { on: "2026-10-08", day: "tomorrow", time: null, repeats: "every day" },
    });
    await captureTask(repo, "rent monthly", NOW, LONDON, "2026-11-01" as LocalDate);
    expect(calls.create.map((c) => [c.schedule, c.recurrence])).toEqual([
      [{ kind: "day", on: "2026-10-08" }, { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } }],
      [{ kind: "day", on: "2026-11-01" }, { kind: "series", rule: { freq: "monthly", interval: 1, end: { kind: "never" } } }],
    ]);
  });

  it("pins the end to a date or a count, and says it", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "class every tuesday 19:00 for 6 weeks", NOW, LONDON)).toMatchObject({
      landed: { on: "2026-10-13", repeats: "every Tuesday, until Monday 23 November" },
    });
    await captureTask(repo, "class every tuesday x10", NOW, LONDON);
    expect(calls.create.map((c) => c.recurrence)).toEqual([
      { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "until", on: "2026-11-23" } } },
      { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "count", count: 10 } } },
    ]);
  });

  it("refuses a repeat that would end before it starts, without touching the repo", async () => {
    const { repo, calls } = fakeRepo();
    expect(await captureTask(repo, "class every friday until tomorrow", NOW, LONDON)).toEqual({ ok: false, error: expect.stringMatching(/end before it starts/) });
    expect(calls.create).toEqual([]);
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
});
