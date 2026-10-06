import { parseItemKey } from "@/domain/item-key";
import { displayTitle } from "@/features/notes/model";
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
    return { key: rawKey as string, title: displayTitle(item), type: item.type, done: item.status === "done", href: null };
  } catch {
    return null;
  }
}
