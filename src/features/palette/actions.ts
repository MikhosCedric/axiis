"use server";

import { getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { describeItem } from "./commands";
import type { Target } from "./model";

// The key is untrusted; describeItem parses it, and RLS scopes the read to the session's user.
export async function describeItemAction(key: string): Promise<Target | null> {
  return describeItem(await getItemsRepo(), key, await getTimeZone());
}
