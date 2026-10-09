import { describe, expect, it } from "vitest";
import type { AreaId, LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { loadDue } from "./commands";

const d = (s: string) => s as LocalDate;
const now = new Date("2026-10-08T10:00:00Z");
const work = "00000000-0000-4000-9000-000000000001" as AreaId;

const run = (items: ReturnType<typeof makeItem>[]) => loadDue(fakeRepo(items, [{ id: work, name: "Work", position: 1 }]).repo, now, "UTC");

describe("loadDue", () => {
  it("lists dated open items soonest first, grouped and worded against today", async () => {
    const data = await run([
      makeItem({ title: "Later", dueOn: d("2026-11-01") }),
      makeItem({ title: "Behind", dueOn: d("2026-10-05"), areaId: work }),
      makeItem({ title: "Tomorrow", dueOn: d("2026-10-09") }),
    ]);
    expect(data.today).toBe("2026-10-08");
    expect(data.rows.map((r) => [r.title, r.group, r.due, r.area])).toEqual([
      ["Behind", "past", "Was due Monday 5 October", "Work"],
      ["Tomorrow", "week", "Due tomorrow", null],
      ["Later", "later", "Due Sunday 1 November", null],
    ]);
  });

  it("leaves out undated items, notes, subtasks and series", async () => {
    const parent = makeItem({ title: "Parent", dueOn: d("2026-10-09") });
    const data = await run([
      makeItem({ title: "No date" }),
      makeItem({ title: "A note", type: "note", dueOn: d("2026-10-09") }),
      makeItem({ title: "Subtask", parentId: parent.id, dueOn: d("2026-10-09") }),
      makeItem({
        title: "A series",
        dueOn: d("2026-10-09"),
        schedule: { kind: "day", on: d("2026-10-01") },
        recurrence: { kind: "series", rule: { freq: "daily", interval: 1, end: { kind: "never" } } },
      }),
      parent,
    ]);
    expect(data.rows.map((r) => r.title)).toEqual(["Parent"]);
  });

  it("keeps an item done within the last day, so a tick can be undone, and drops an older one", async () => {
    const data = await run([
      makeItem({ title: "Just done", status: "done", completedAt: new Date("2026-10-08T09:00:00Z"), dueOn: d("2026-10-08") }),
      makeItem({ title: "Done last week", status: "done", completedAt: new Date("2026-10-01T09:00:00Z"), dueOn: d("2026-10-02") }),
    ]);
    expect(data.rows.map((r) => [r.title, r.done])).toEqual([["Just done", true]]);
  });

  it("says when an item is planned for a day", async () => {
    const data = await run([makeItem({ title: "Planned", dueOn: d("2026-10-12"), schedule: { kind: "day", on: d("2026-10-10") } })]);
    expect(data.rows[0].when).toBe("Saturday 10 October");
  });

  it("is empty when nothing is dated", async () => {
    expect(await run([makeItem()])).toEqual({ today: "2026-10-08", rows: [], full: false });
  });
});
