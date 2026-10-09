"use server";

import { refresh } from "next/cache";
import { getNow, getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import type { ActionResult } from "@/features/today/commands";
import { moveLeftoverToToday } from "./leftover";

// No input to trust: the repo reads the signed-in user's own rows, and RLS scopes every write.
export async function moveLeftoverAction(): Promise<ActionResult> {
  const result = await moveLeftoverToToday(await getItemsRepo(), getNow(), await getTimeZone());
  if (result.ok) refresh();
  return result;
}
