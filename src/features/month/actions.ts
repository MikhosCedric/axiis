"use server";

import { refresh } from "next/cache";
import { planDateSchema } from "@/domain/item";
import { getNow, getTimeZone } from "@/features/day/server";
import { captureTask, type CaptureResult } from "@/features/today/commands";
import { getItemsRepo } from "@/lib/items";

/**
 * Capture from the Month: a line that names no day lands on the focused day.
 * A day that does not parse is ignored, so the line captures as it would anywhere else.
 */
export async function captureOnAction(title: string, on: string): Promise<CaptureResult> {
  const day = planDateSchema.safeParse(on);
  const result = await captureTask(await getItemsRepo(), title, getNow(), await getTimeZone(), day.success ? day.data : null);
  if (result.ok) refresh();
  return result;
}
