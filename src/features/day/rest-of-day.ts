
import { repeats } from "@/domain/item";
import type { TodayEntry } from "@/features/today/model";
import { reach } from "@/lib/reach";

export type RestItem = { id: string; title: string };

/**
 * What "the rest of today" holds: tasks and checklists planned for the day that are still open and not happening
 * now. An event is where it is, a series' occurrence moves one at a time, and a subtask goes with its parent.
 */
export function restOfDay(entries: readonly TodayEntry[]): RestItem[] {
  return entries
    .filter(
      (e) =>
        e.state === "planned" &&
        e.item.status === "open" &&
        (e.item.type === "task" || e.item.type === "checklist") &&
        e.item.parentId === null &&
        !repeats(e.item) &&
        e.item.schedule.kind !== "unscheduled",
    )
    .map((e) => ({ id: e.item.id, title: e.item.title }));
}

/** Plans each of `rows` for `when` with `plan`, all at once; the rows that saved, in the order given. */
export async function moveRows(
  plan: (id: string, when: "today" | "tomorrow") => Promise<{ ok: boolean }>,
  rows: readonly RestItem[],
  when: "today" | "tomorrow",
): Promise<RestItem[]> {
  const results = await Promise.all(rows.map((r) => reach(plan(r.id, when))));
  return rows.filter((_, i) => results[i].ok);
}

/** The news after the move: "3 things are planned for tomorrow." */
export function restNews(moved: number, failed: number): string {
  const said = moved === 1 ? "1 thing is planned for tomorrow." : `${moved} things are planned for tomorrow.`;
  if (moved === 0) return "That did not save. Try again.";
  return failed ? `${said} ${failed} did not save. Try again.` : said;
}
