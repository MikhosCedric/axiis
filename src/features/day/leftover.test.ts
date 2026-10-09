import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { instantAt } from "@/lib/dates";
import { BEHIND_LIMIT } from "@/lib/items/repo";
import { loadLeftover, moveLeftoverToToday } from "./leftover";
import { LEFTOVER_SHOWN, leftoverHeading } from "./leftover-model";

const d = (s: string) => s as LocalDate;
const today = d("2026-10-08");
const day = (title: string, on: string, over = {}) => makeItem({ title, schedule: { kind: "day", on: d(on) }, ...over });

describe("loadLeftover", () => {
  it("names open items planned before today, oldest first, with the day in words", async () => {
    const timed = makeItem({ title: "Call back", schedule: { kind: "timed", start: instantAt(d("2026-10-06"), 600, "UTC"), end: instantAt(d("2026-10-06"), 630, "UTC") } });
    const data = await loadLeftover(fakeRepo([day("Later one", "2026-10-07"), timed, day("Oldest", "2026-10-02")]).repo, today, "UTC");
    expect(data?.rows.map((r) => [r.title, r.planned])).toEqual([
      ["Oldest", "Planned Friday 2 October"],
      ["Call back", "Planned Tuesday 6 October"],
      ["Later one", "Planned Wednesday 7 October"],
    ]);
    expect(data?.total).toBe(3);
  });

  it("leaves out today, later days, done and dropped items, notes, subtasks, series and unplanned items", async () => {
    const parent = day("Parent", "2026-10-09");
    const data = await loadLeftover(
      fakeRepo([
        day("Today", "2026-10-08"),
        day("Tomorrow", "2026-10-09"),
        day("Done", "2026-10-01", { status: "done" }),
        day("Dropped", "2026-10-01", { status: "dropped" }),
        day("Sub", "2026-10-01", { parentId: parent.id }),
        day("Series", "2026-10-01", { recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } } }),
        makeItem({ title: "Waiting" }),
        parent,
      ]).repo,
      today,
      "UTC",
    );
    expect(data).toBeNull();
  });

  it("counts the first day's items by the user's zone, not UTC", async () => {
    // 23:30 on the 7th in Los Angeles is already the 8th in UTC: still yesterday there, not today.
    const late = makeItem({ title: "Late", schedule: { kind: "timed", start: new Date("2026-10-08T06:30:00Z"), end: new Date("2026-10-08T07:00:00Z") } });
    expect((await loadLeftover(fakeRepo([late]).repo, today, "America/Los_Angeles"))?.rows.map((r) => r.planned)).toEqual(["Planned Wednesday 7 October"]);
    expect(await loadLeftover(fakeRepo([late]).repo, today, "UTC")).toBeNull();
  });

  it("shows the first few and counts them all", async () => {
    const many = Array.from({ length: LEFTOVER_SHOWN + 3 }, (_, i) => day(`Item ${i}`, `2026-09-${String(10 + i).padStart(2, "0")}`));
    const data = await loadLeftover(fakeRepo(many).repo, today, "UTC");
    expect(data?.rows).toHaveLength(LEFTOVER_SHOWN);
    expect(data?.total).toBe(LEFTOVER_SHOWN + 3);
  });
});

describe("leftoverHeading", () => {
  it("says one, several and the capped count in plain words", () => {
    expect(leftoverHeading(1)).toBe("1 thing from an earlier day is still open");
    expect(leftoverHeading(4)).toBe("4 things from earlier days are still open");
    expect(leftoverHeading(BEHIND_LIMIT)).toBe(`${BEHIND_LIMIT}+ things from earlier days are still open`);
  });
});

describe("moveLeftoverToToday", () => {
  it("moves every item left over to today, leaving others alone", async () => {
    const old = day("Old", "2026-10-02");
    const timed = makeItem({ title: "Timed", schedule: { kind: "timed", start: instantAt(d("2026-10-06"), 600, "UTC"), end: instantAt(d("2026-10-06"), 630, "UTC") } });
    const fine = day("Fine", "2026-10-09");
    const fake = fakeRepo([old, timed, fine]);
    expect(await moveLeftoverToToday(fake.repo, new Date("2026-10-08T10:00:00Z"), "UTC")).toEqual({ ok: true });
    expect((await fake.repo.get(old.id))?.schedule).toEqual({ kind: "day", on: today });
    // A timed item keeps its time of day on the new day.
    expect((await fake.repo.get(timed.id))?.schedule).toEqual({ kind: "timed", start: instantAt(today, 600, "UTC"), end: instantAt(today, 630, "UTC") });
    expect((await fake.repo.get(fine.id))?.schedule).toEqual({ kind: "day", on: "2026-10-09" });
    expect(await loadLeftover(fake.repo, today, "UTC")).toBeNull();
  });

  it("says so when the read fails", async () => {
    const fake = fakeRepo();
    fake.repo.listBehind = async () => {
      throw new Error("down");
    };
    const result = await moveLeftoverToToday(fake.repo, new Date("2026-10-08T10:00:00Z"), "UTC");
    expect(result.ok).toBe(false);
  });
});
