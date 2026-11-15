import { describe, expect, it } from "vitest";
import type { AreaId } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { loadDone } from "./commands";
import { DONE_PAGE, groupByDay } from "./model";

const now = new Date("2026-10-08T10:00:00Z");
const work = "00000000-0000-4000-9000-000000000001" as AreaId;
const done = (title: string, at: string, over = {}) => makeItem({ title, status: "done", completedAt: new Date(at), ...over });
const run = (items: ReturnType<typeof makeItem>[], pages = 1, tz = "UTC") =>
  loadDone(fakeRepo(items, [{ id: work, name: "Work", position: 1, color: null }]).repo, now, tz, pages);

describe("loadDone", () => {
  it("lists finished items newest first, by the day finished in the user's zone", async () => {
    const data = await run(
      [
        done("Early", "2026-10-07T09:00:00Z", { areaId: work }),
        done("Late", "2026-10-08T08:00:00Z"),
        done("Night", "2026-10-07T23:30:00Z"),
      ],
      1,
      "Asia/Manila",
    );
    expect(data.rows.map((r) => [r.title, r.doneOn, r.area])).toEqual([
      ["Late", "2026-10-08", null],
      ["Night", "2026-10-08", null],
      ["Early", "2026-10-07", "Work"],
    ]);
    expect(groupByDay(data.rows, data.today).map((g) => g.heading)).toEqual(["Today", "Yesterday"]);
  });

  it("leaves out open items, notes, subtasks and series", async () => {
    const parent = makeItem({ title: "Parent" });
    const data = await run([
      makeItem({ title: "Open" }),
      done("A note", "2026-10-08T01:00:00Z", { type: "note" }),
      done("Subtask", "2026-10-08T01:00:00Z", { parentId: parent.id }),
      done("Kept", "2026-10-08T01:00:00Z"),
    ]);
    expect(data.rows.map((r) => r.title)).toEqual(["Kept"]);
  });

  it("pages: the first page stops at its size and says there is more; a later page reaches further", async () => {
    const items = Array.from({ length: DONE_PAGE + 5 }, (_, i) => done(`T${i}`, new Date(now.getTime() - i * 60_000).toISOString()));
    const first = await run(items);
    expect(first.rows).toHaveLength(DONE_PAGE);
    expect(first.more).toBe(true);
    const second = await run(items, 2);
    expect(second.rows).toHaveLength(DONE_PAGE + 5);
    expect(second.more).toBe(false);
  });

  it("is empty when nothing is finished", async () => {
    expect(await run([makeItem()])).toMatchObject({ rows: [], more: false });
  });
});
