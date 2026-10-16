import { displayTitle } from "@/features/notes/model";
import { whenOf } from "@/features/tags/commands";
import type { Clock } from "@/lib/clock";
import { toLocalDate } from "@/lib/dates";
import { DUE_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import { dueGroup, dueWords, type DueData } from "./model";

const DAY_MS = 86_400_000;

/**
 * Every task and checklist with a due date, soonest first. Items done in the
 * last day stay listed, so a mistaken tick can be undone.
 */
export async function loadDue(repo: ItemsRepo, now: Date, timeZone: string, clock: Clock): Promise<DueData> {
  const today = toLocalDate(now, timeZone);
  const [items, areas] = await Promise.all([repo.listDue(new Date(now.getTime() - DAY_MS)), repo.listAreas()]);
  const areaOf = new Map(areas.map((a) => [a.id as string, a]));
  return {
    today,
    rows: items.flatMap((item) => {
      // The read only returns items with a due date; this narrows the type.
      if (item.dueOn === null) return [];
      const done = item.status === "done";
      return [
        {
          id: item.id,
          type: item.type,
          title: displayTitle(item),
          done,
          dueOn: item.dueOn,
          due: dueWords(item.dueOn, today, done),
          group: dueGroup(item.dueOn, today),
          when: item.schedule.kind === "unscheduled" ? null : whenOf(item, timeZone, clock),
          area: areaOf.get(item.areaId ?? "")?.name ?? null,
          areaColor: areaOf.get(item.areaId ?? "")?.color ?? null,
        },
      ];
    }),
    full: items.length >= DUE_LIMIT,
  };
}
