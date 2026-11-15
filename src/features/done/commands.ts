import { quickItem } from "@/features/actions/quick-item";
import { displayTitle } from "@/features/notes/model";
import { tagsOfShown } from "@/features/tags/commands";
import { toLocalDate } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import type { TagColors } from "@/domain/tag";
import { DONE_PAGE, type DoneData } from "./model";

/**
 * Tasks and checklists finished, newest first. One more than the page is read, only to know whether
 * "Show earlier" has anything to show.
 */
export async function loadDone(
  repo: ItemsRepo,
  now: Date,
  timeZone: string,
  pages = 1,
): Promise<DoneData & { tagColors: TagColors }> {
  const size = pages * DONE_PAGE;
  const [read, areas] = await Promise.all([repo.listDone(size + 1), repo.listAreas()]);
  const items = read.slice(0, size);
  const areaOf = new Map(areas.map((a) => [a.id as string, a]));
  // Series occurrences are not read here, so no item wears a series' tags.
  const tags = await tagsOfShown(repo, items, []);
  return {
    today: toLocalDate(now, timeZone),
    pages,
    more: read.length > size,
    tagColors: tags.colors,
    rows: items.flatMap((item) =>
      item.completedAt === null
        ? []
        : [
            {
              quick: { ...quickItem(item, timeZone), title: displayTitle(item) },
              id: item.id,
              type: item.type,
              title: displayTitle(item),
              doneOn: toLocalDate(item.completedAt, timeZone),
              areaId: item.areaId,
              area: areaOf.get(item.areaId ?? "")?.name ?? null,
              areaColor: areaOf.get(item.areaId ?? "")?.color ?? null,
              tags: tags.names[item.id] ?? [],
            },
          ],
    ),
  };
}
