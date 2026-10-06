"use server";

import { refresh } from "next/cache";
import { getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { captureTask, setDone, type ActionResult } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write, so a direct POST without a session cannot touch anyone's rows.

export async function captureAction(title: string): Promise<ActionResult> {
  const result = await captureTask(await getItemsRepo(), title);
  if (result.ok) refresh();
  return result;
}

export async function setDoneAction(id: string, done: boolean): Promise<ActionResult> {
  const result = await setDone(await getItemsRepo(), id, done, await getTimeZone());
  if (result.ok) refresh();
  return result;
}
