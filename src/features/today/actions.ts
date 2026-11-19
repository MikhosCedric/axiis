"use server";

import { refresh } from "next/cache";
import { areasNamedIn, getNow, getTimeZone, getWeekStart } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { captureLines, captureList, captureTask, queuedId, setDone, typedAt, type ActionResult, type CaptureResult, type QueuedEntry } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write, so a direct POST without a session cannot touch anyone's rows.

export async function captureAction(title: string, entry?: QueuedEntry): Promise<CaptureResult> {
  const now = await getNow();
  const areas = await areasNamedIn(title);
  const result = await captureTask(await getItemsRepo(), title, typedAt(entry, now), await getTimeZone(), null, queuedId(entry), await getWeekStart(), areas);
  if (result.ok) refresh();
  return result;
}

/** A pasted block as one task per line. The lines are untrusted; the command validates them. */
export async function captureLinesAction(lines: string[]): Promise<CaptureResult> {
  const result = await captureLines(await getItemsRepo(), lines, await getNow(), await getTimeZone(), null, await getWeekStart(), await areasNamedIn(lines));
  // Some lines may have saved before one failed, so the screen is redrawn either way.
  refresh();
  return result;
}

/** A pasted block as a checklist named by its first line. */
export async function captureListAction(lines: string[]): Promise<CaptureResult> {
  const result = await captureList(await getItemsRepo(), lines);
  refresh();
  return result;
}

export async function setDoneAction(id: string, done: boolean): Promise<ActionResult> {
  const result = await setDone(await getItemsRepo(), id, done, await getTimeZone());
  if (result.ok) refresh();
  return result;
}
