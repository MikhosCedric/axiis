import { z } from "zod";
import type { ItemId } from "@/domain/item";
import { parseItemKey } from "@/domain/item-key";
import { materialize } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import { TITLE_MAX } from "./model";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That item could not be found.";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);

/** A capture's result. On success it names the new item, so a screen can open it and say where it went. */
export type CaptureResult = { ok: true; id: ItemId; type: "task" | "checklist" } | { ok: false; error: string };

export function captureTask(repo: ItemsRepo, raw: unknown): Promise<CaptureResult> {
  return capture(repo, raw, "task");
}

/** Captures an unscheduled, top-level checklist. Its lines are added in the detail panel. */
export function captureChecklist(repo: ItemsRepo, raw: unknown): Promise<CaptureResult> {
  return capture(repo, raw, "checklist");
}

async function capture(repo: ItemsRepo, raw: unknown, type: "task" | "checklist"): Promise<CaptureResult> {
  const title = titleSchema.safeParse(raw);
  if (!title.success) {
    return { ok: false, error: `Titles can be up to ${TITLE_MAX} characters. Put the rest in a note later.` };
  }
  try {
    const item = await repo.create({ type, title: title.data, schedule: { kind: "unscheduled" } });
    return { ok: true, id: item.id, type };
  } catch {
    return { ok: false, error: "That did not save. Your words are still here, so try again." };
  }
}

/** Marks an item, or one occurrence of a series, done or open again. */
export async function setDone(repo: ItemsRepo, rawKey: unknown, done: boolean, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: NOT_FOUND };
  try {
    const id = key.kind === "item" ? key.id : (await materialize(repo, key, timeZone))?.id;
    if (!id) return { ok: false, error: NOT_FOUND };
    await repo.update(id, { status: done ? "done" : "open" });
    return { ok: true };
  } catch {
    return { ok: false, error: "That change did not save. Try again." };
  }
}
