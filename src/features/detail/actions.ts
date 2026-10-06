"use server";

import { refresh } from "next/cache";
import { getNow, getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import type { ActionResult } from "@/features/today/commands";
import { addSubtask, deleteItem, promoteSubtask, renameItem, setItemArea, setRepeat, stopRepeating } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write, so a direct POST without a session cannot touch anyone's rows.
// Scopes and repeat choices arrive untyped and are parsed by the commands.

function refreshed(result: ActionResult): ActionResult {
  if (result.ok) refresh();
  return result;
}

export async function renameItemAction(id: string, title: string, scope?: unknown): Promise<ActionResult> {
  return refreshed(await renameItem(await getItemsRepo(), id, title, await getTimeZone(), scope));
}

export async function setAreaAction(id: string, areaId: string | null, scope?: unknown): Promise<ActionResult> {
  return refreshed(await setItemArea(await getItemsRepo(), id, areaId, await getTimeZone(), scope));
}

export async function addSubtaskAction(parentId: string, title: string): Promise<ActionResult> {
  return refreshed(await addSubtask(await getItemsRepo(), parentId, title));
}

export async function promoteSubtaskAction(id: string): Promise<ActionResult> {
  return refreshed(await promoteSubtask(await getItemsRepo(), id));
}

export async function deleteItemAction(id: string, scope?: unknown): Promise<ActionResult> {
  return refreshed(await deleteItem(await getItemsRepo(), id, await getTimeZone(), scope));
}

export async function setRepeatAction(id: string, choice: unknown): Promise<ActionResult> {
  return refreshed(await setRepeat(await getItemsRepo(), id, choice, getNow(), await getTimeZone()));
}

export async function stopRepeatingAction(id: string): Promise<ActionResult> {
  return refreshed(await stopRepeating(await getItemsRepo(), id, await getTimeZone()));
}
