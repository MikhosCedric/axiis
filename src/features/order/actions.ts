"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";
import { reorderChecklists, reorderChildren } from "./commands";

// The ids are untrusted; the commands check them against what the session's user owns, and RLS scopes every write.

export async function reorderChildrenAction(parentId: string, ids: string[]): Promise<ActionResult> {
  const result = await reorderChildren(await getItemsRepo(), parentId, ids);
  if (result.ok) refresh();
  return result;
}

export async function reorderChecklistsAction(ids: string[]): Promise<ActionResult> {
  const result = await reorderChecklists(await getItemsRepo(), ids);
  if (result.ok) refresh();
  return result;
}
