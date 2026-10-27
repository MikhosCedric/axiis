import { quickItem } from "@/features/actions/quick-item";
import type { Clock } from "@/lib/clock";
import { repeats } from "@/domain/item";
import { displayTitle } from "@/features/notes/model";
import { whenOf } from "@/features/tags/commands";
import { LISTS_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import type { ListsData } from "./model";

/** Every checklist with its progress, open first. Lines are counted in one read for all of them. */
export async function loadLists(repo: ItemsRepo, timeZone: string, clock: Clock): Promise<ListsData> {
  const [items, areas] = await Promise.all([repo.listChecklists(), repo.listAreas()]);
  const counts = await repo.childCounts(items.map((i) => i.id));
  const areaOf = new Map(areas.map((a) => [a.id as string, a]));
  return {
    rows: items.map((item) => ({
      quick: { ...quickItem(item, timeZone), title: displayTitle(item) },
      id: item.id,
      title: displayTitle(item),
      done: item.status === "done",
      repeats: repeats(item),
      // A series always has a schedule, so "no day" only ever hides a plain checklist's.
      when: item.schedule.kind === "unscheduled" ? null : whenOf(item, timeZone, clock),
      areaId: item.areaId,
      area: areaOf.get(item.areaId ?? "")?.name ?? null,
      areaColor: areaOf.get(item.areaId ?? "")?.color ?? null,
      progress: repeats(item) ? null : (counts[item.id] ?? { done: 0, total: 0 }),
    })),
    full: items.length >= LISTS_LIMIT,
  };
}
