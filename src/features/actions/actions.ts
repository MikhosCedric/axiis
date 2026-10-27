"use server";

import { refresh } from "next/cache";
import { getTimeZone } from "@/features/day/server";
import type { ActionResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";
import { duplicateItem, restoreItems, tagChoices, type DuplicateResult } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write, so ids from the client can only reach the caller's own rows. Inputs
// arrive untyped and are parsed by the commands.

export async function restoreItemsAction(ids: string[]): Promise<ActionResult> {
  const result = await restoreItems(await getItemsRepo(), ids);
  if (result.ok) refresh();
  return result;
}

export async function duplicateItemAction(key: string): Promise<DuplicateResult> {
  const result = await duplicateItem(await getItemsRepo(), key, await getTimeZone());
  if (result.ok) refresh();
  return result;
}

export async function tagChoicesAction() {
  return tagChoices(await getItemsRepo());
}
