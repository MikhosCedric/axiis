"use server";

import { refresh } from "next/cache";
import { captureChecklist, type CaptureResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";

// The title is untrusted; captureChecklist validates it, and RLS scopes the write to the session's user.
export async function captureChecklistAction(title: string): Promise<CaptureResult> {
  const result = await captureChecklist(await getItemsRepo(), title);
  if (result.ok) refresh();
  return result;
}
