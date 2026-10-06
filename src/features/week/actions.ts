"use server";

import { refresh } from "next/cache";
import { getTimeZone } from "@/features/day/server";
import type { ActionResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";
import { moveItem } from "./commands";

// Inputs are untrusted; moveItem validates them, and RLS scopes the write to the session's user.
export async function moveAction(id: string, to: string): Promise<ActionResult> {
  const result = await moveItem(await getItemsRepo(), id, to, await getTimeZone());
  if (result.ok) refresh();
  return result;
}
