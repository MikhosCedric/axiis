import { parseItemKey } from "@/domain/item-key";
import { quickItem } from "@/features/actions/quick-item";
import { loadDay } from "@/features/day/load";
import { restOfDay, type RestItem } from "@/features/day/rest-of-day";
import { displayTitle } from "@/features/notes/model";
import { toLocalDate } from "@/lib/dates";
import { resolveKey } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import type { Target } from "./model";

/**
 * The item a screen has selected, as the palette acts on it: named by the key
 * the screen uses, so an occurrence of a series stays that one occurrence.
 * Null for a key that names nothing. It is already open, so it has no link.
 */
export async function describeItem(repo: ItemsRepo, rawKey: unknown, timeZone: string): Promise<Target | null> {
  const key = parseItemKey(rawKey);
  if (!key) return null;
  try {
    const found = await resolveKey(repo, key, timeZone);
    if (!found || found.item.status === "dropped") return null;
    const { item } = found;
    const title = displayTitle(item);
    return {
      key: rawKey as string,
      title,
      type: item.type,
      done: item.status === "done",
      href: null,
      quick: { ...quickItem(item, timeZone), key: rawKey as string, title },
    };
  } catch {
    return null;
  }
}

/** What "plan the rest of today for tomorrow" would move: the same open tasks and checklists Today's button moves. Empty when the read fails. */
export async function restOfToday(repo: ItemsRepo, now: Date, timeZone: string): Promise<RestItem[]> {
  try {
    return restOfDay((await loadDay(repo, toLocalDate(now, timeZone), now, timeZone)).view.scheduled);
  } catch {
    return [];
  }
}
