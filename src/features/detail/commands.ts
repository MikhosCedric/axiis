import { z } from "zod";
import { idSchema, type AreaId, type ItemId, type ItemPatch } from "@/domain/item";
import type { ItemsRepo } from "@/lib/items/repo";
import type { ActionResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { buildDetail, subtaskPolicy, type DetailView } from "./model";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);
const areaSchema = idSchema.nullable();

const TITLE_ERROR = `A title needs a few words, up to ${TITLE_MAX} characters.`;
const MISSING = "That item is not here any more.";
const NOT_SAVED = "That change did not save. Try again.";

export function parseItemId(raw: unknown): ItemId | null {
  const id = idSchema.safeParse(raw);
  return id.success ? (id.data as ItemId) : null;
}

async function attempt(work: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await work()) ?? { ok: true };
  } catch {
    return { ok: false, error: NOT_SAVED };
  }
}

function save(repo: ItemsRepo, id: ItemId, patch: ItemPatch): Promise<ActionResult> {
  return attempt(async () => {
    await repo.update(id, patch);
  });
}

export async function loadDetail(repo: ItemsRepo, id: ItemId, timeZone: string): Promise<DetailView | null> {
  const item = await repo.get(id);
  if (!item) return null;
  const policy = subtaskPolicy(item);
  const [areas, subtasks, parent] = await Promise.all([
    repo.listAreas(),
    policy.kind === "holds-subtasks" ? repo.listChildren(item.id) : [],
    policy.kind === "is-subtask" ? repo.get(policy.parentId) : null,
  ]);
  return buildDetail({ item, areas, subtasks, parent, timeZone });
}

export async function renameItem(repo: ItemsRepo, rawId: unknown, rawTitle: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) return { ok: false, error: TITLE_ERROR };
  return save(repo, id, { title: title.data });
}

export async function setItemArea(repo: ItemsRepo, rawId: unknown, rawAreaId: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  const areaId = areaSchema.safeParse(rawAreaId);
  if (!areaId.success) return { ok: false, error: "That area could not be found." };
  return save(repo, id, { areaId: areaId.data as AreaId | null });
}

export async function addSubtask(repo: ItemsRepo, rawParentId: unknown, rawTitle: unknown): Promise<ActionResult> {
  const parentId = parseItemId(rawParentId);
  if (!parentId) return { ok: false, error: MISSING };
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) return { ok: false, error: TITLE_ERROR };
  return attempt(async () => {
    const parent = await repo.get(parentId);
    if (!parent) return { ok: false, error: MISSING };
    // Turns the database trigger's refusal into a sentence instead of a failed save.
    if (subtaskPolicy(parent).kind !== "holds-subtasks") {
      return { ok: false, error: "Subtasks go one level deep, under a task or a checklist." };
    }
    await repo.create({
      type: "task",
      title: title.data,
      parentId,
      areaId: parent.areaId,
      schedule: { kind: "unscheduled" },
    });
  });
}

/** Lifts a subtask out to the top level, where it waits for a time like any captured task. */
export async function promoteSubtask(repo: ItemsRepo, rawId: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  return save(repo, id, { parentId: null });
}

/**
 * Soft-deletes the item and its subtasks. Children go first so a failure part
 * way leaves the parent in place, and running it again finishes the job.
 */
export async function deleteItem(repo: ItemsRepo, rawId: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  return attempt(async () => {
    for (const child of await repo.listChildren(id)) await repo.softDelete(child.id);
    await repo.softDelete(id);
  });
}
