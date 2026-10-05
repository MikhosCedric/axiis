"use server";

import { refresh } from "next/cache";
import { getItemsRepo } from "@/lib/items";
import type { ActionResult } from "@/features/today/commands";
import { placeItem } from "./commands";

// Inputs are untrusted; placeItem validates them, and RLS scopes the write to the session's user.
export async function placeAction(id: string, placement: unknown): Promise<ActionResult> {
  const result = await placeItem(await getItemsRepo(), id, placement);
  if (result.ok) refresh();
  return result;
}
