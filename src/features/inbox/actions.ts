"use server";

import { refresh } from "next/cache";
import { getNow, getTimeZone } from "@/features/day/server";
import type { ActionResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";
import { planItem } from "./commands";

// Inputs are untrusted; planItem validates them, and RLS scopes the write to the session's user.
export async function planAction(id: string, when: string): Promise<ActionResult> {
  const result = await planItem(await getItemsRepo(), id, when, getNow(), await getTimeZone());
  if (result.ok) refresh();
  return result;
}
