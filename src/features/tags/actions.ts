"use server";

import { refresh } from "next/cache";
import { getTimeZone } from "@/features/day/server";
import type { ActionResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";
import { addTag, deleteTag, removeTag, renameTag, setTagColor } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write. Names and ids arrive untyped and are parsed by the commands.

function refreshed(result: ActionResult): ActionResult {
  if (result.ok) refresh();
  return result;
}

export async function addTagAction(itemId: string, name: string): Promise<ActionResult> {
  return refreshed(await addTag(await getItemsRepo(), itemId, name, await getTimeZone()));
}

export async function removeTagAction(itemId: string, name: string): Promise<ActionResult> {
  return refreshed(await removeTag(await getItemsRepo(), itemId, name, await getTimeZone()));
}

export async function renameTagAction(tagId: string, name: string): Promise<ActionResult> {
  return refreshed(await renameTag(await getItemsRepo(), tagId, name));
}

export async function setTagColorAction(tagId: string, color: string | null): Promise<ActionResult> {
  return refreshed(await setTagColor(await getItemsRepo(), tagId, color));
}

export async function deleteTagAction(tagId: string): Promise<ActionResult> {
  return refreshed(await deleteTag(await getItemsRepo(), tagId));
}
