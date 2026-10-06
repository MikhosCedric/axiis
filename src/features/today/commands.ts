import { z } from "zod";
import { parseItemKey } from "@/domain/item-key";
import { materialize } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import { TITLE_MAX } from "./model";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That item could not be found.";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);

export async function captureTask(repo: ItemsRepo, raw: unknown): Promise<ActionResult> {
  const title = titleSchema.safeParse(raw);
  if (!title.success) {
    return { ok: false, error: `Titles can be up to ${TITLE_MAX} characters. Put the rest in a note later.` };
  }
  try {
    await repo.create({ type: "task", title: title.data, schedule: { kind: "unscheduled" } });
    return { ok: true };
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
