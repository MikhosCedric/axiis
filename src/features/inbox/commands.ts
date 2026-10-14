import { DATE_RANGE_ERROR, outOfRange, toLocalDate } from "@/lib/dates";
import { INBOX_LIMIT, type ItemsRepo } from "@/lib/items/repo";
import type { ActionResult } from "@/features/today/commands";
import { moveItem, MOVE_FAILED } from "@/features/week/commands";
import { tagsOfShown } from "@/features/tags/commands";
import { parsePlanFor, planDate, type InboxData } from "./model";

export async function loadInbox(repo: ItemsRepo, now: Date, timeZone: string): Promise<InboxData> {
  const [areas, items] = await Promise.all([repo.listAreas(), repo.listInbox()]);
  // Inbox items are never overrides, so none wears a series' tags.
  const [childCounts, tags] = await Promise.all([repo.childCounts(items.map((i) => i.id)), tagsOfShown(repo, items, [])]);
  return {
    timeZone,
    today: toLocalDate(now, timeZone),
    areas,
    items,
    childCounts,
    tags,
    full: items.length >= INBOX_LIMIT,
  };
}

/**
 * Plans an item for a day. The client names the day ("today", "tomorrow" or a
 * date); which date today is comes from the server's clock and the user's time
 * zone, and the schedule itself is built by `moveItem`.
 */
export async function planItem(repo: ItemsRepo, rawKey: unknown, rawWhen: unknown, now: Date, timeZone: string): Promise<ActionResult> {
  const when = parsePlanFor(rawWhen);
  if (!when) return { ok: false, error: outOfRange(rawWhen) ? DATE_RANGE_ERROR : MOVE_FAILED };
  return moveItem(repo, rawKey, planDate(when, toLocalDate(now, timeZone)), timeZone);
}
