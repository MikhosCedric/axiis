"use server";

import { refresh } from "next/cache";
import { getItemsRepo } from "@/lib/items";
import type { ActionResult } from "@/features/today/commands";
import { addSubtask, deleteItem, promoteSubtask, renameItem, setItemArea } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write, so a direct POST without a session cannot touch anyone's rows.

function refreshed(result: ActionResult): ActionResult {
  if (result.ok) refresh();
  return result;
}

export async function renameItemAction(id: string, title: string): Promise<ActionResult> {
  return refreshed(await renameItem(await getItemsRepo(), id, title));
}

export async function setAreaAction(id: string, areaId: string | null): Promise<ActionResult> {
  return refreshed(await setItemArea(await getItemsRepo(), id, areaId));
}

export async function addSubtaskAction(parentId: string, title: string): Promise<ActionResult> {
  return refreshed(await addSubtask(await getItemsRepo(), parentId, title));
}

export async function promoteSubtaskAction(id: string): Promise<ActionResult> {
  return refreshed(await promoteSubtask(await getItemsRepo(), id));
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  return refreshed(await deleteItem(await getItemsRepo(), id));
}
