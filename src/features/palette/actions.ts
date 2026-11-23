"use server";

import { getNow, getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { describeItem, restOfToday } from "./commands";
import type { Target } from "./model";

// The key is untrusted; describeItem parses it, and RLS scopes the read to the session's user.
export async function describeItemAction(key: string): Promise<Target | null> {
  return describeItem(await getItemsRepo(), key, await getTimeZone());
}

export async function restOfTodayAction() {
  return restOfToday(await getItemsRepo(), await getNow(), await getTimeZone());
}
