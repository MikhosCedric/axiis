import { z } from "zod";
import { idSchema, type AreaId } from "@/domain/item";
import type { AreasRepo } from "@/lib/areas/repo";
import type { ActionResult } from "@/features/today/commands";

export const AREA_NAME_MAX = 40;
export const AREA_LIMIT = 12;
export const DELETE_PHRASE = "delete my account";

export type MoveDirection = "up" | "down";

/** What deleting an account needs from the outside world. */
export type AccountPort = {
  /** Removes the signed-in user and every row they own. Throws if nothing was deleted. */
  deleteMyAccount(): Promise<void>;
  signOut(): Promise<void>;
};

const nameSchema = z.string().trim().min(1).max(AREA_NAME_MAX);
const directionSchema = z.enum(["up", "down"]);
const phraseSchema = z.string().trim().refine((s) => s === DELETE_PHRASE);

const NAME_ERROR = `An area name needs 1 to ${AREA_NAME_MAX} characters.`;
const MISSING = "That area is not here any more.";
const NOT_SAVED = "That change did not save. Try again.";
const taken = (name: string) => `You already have an area called ${name}.`;

function parseAreaId(raw: unknown): AreaId | null {
  const id = idSchema.safeParse(raw);
  return id.success ? (id.data as AreaId) : null;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function attempt(work: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await work()) ?? { ok: true };
  } catch {
    return { ok: false, error: NOT_SAVED };
  }
}

export async function addArea(repo: AreasRepo, rawName: unknown): Promise<ActionResult> {
  const name = nameSchema.safeParse(rawName);
  if (!name.success) return { ok: false, error: NAME_ERROR };
  return attempt(async () => {
    const areas = await repo.list();
    const clash = areas.find((a) => sameName(a.name, name.data));
    if (clash) return { ok: false, error: taken(clash.name) };
    if (areas.length >= AREA_LIMIT) {
      return { ok: false, error: `Axiis keeps up to ${AREA_LIMIT} areas. Remove one to make room.` };
    }
    await repo.create(name.data);
  });
}

export async function renameArea(repo: AreasRepo, rawId: unknown, rawName: unknown): Promise<ActionResult> {
  const id = parseAreaId(rawId);
  if (!id) return { ok: false, error: MISSING };
  const name = nameSchema.safeParse(rawName);
  if (!name.success) return { ok: false, error: NAME_ERROR };
  return attempt(async () => {
    const areas = await repo.list();
    const self = areas.find((a) => a.id === id);
    if (!self) return { ok: false, error: MISSING };
    if (self.name === name.data) return;
    const clash = areas.find((a) => a.id !== id && sameName(a.name, name.data));
    if (clash) return { ok: false, error: taken(clash.name) };
    await repo.rename(id, name.data);
  });
}

export async function removeArea(repo: AreasRepo, rawId: unknown): Promise<ActionResult> {
  const id = parseAreaId(rawId);
  if (!id) return { ok: false, error: MISSING };
  return attempt(() => repo.softDelete(id));
}

/** The ids with `id` swapped one place up or down, or `null` when it is missing or already at that end. */
export function moved(ids: AreaId[], id: AreaId, direction: MoveDirection): AreaId[] | null {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Moves one area a place up or down. The order is read on the server, so a client cannot submit someone else's ids. */
export async function moveArea(repo: AreasRepo, rawId: unknown, rawDirection: unknown): Promise<ActionResult> {
  const id = parseAreaId(rawId);
  const direction = directionSchema.safeParse(rawDirection);
  if (!id || !direction.success) return { ok: false, error: MISSING };
  return attempt(async () => {
    const ids = (await repo.list()).map((a) => a.id);
    if (!ids.includes(id)) return { ok: false, error: MISSING };
    const next = moved(ids, id, direction.data);
    if (next) await repo.reorder(next);
  });
}

export function isDeletePhrase(raw: unknown): boolean {
  return phraseSchema.safeParse(raw).success;
}

/**
 * Deletes the account when the typed phrase matches. Signing out is best effort:
 * once the account is gone the session can no longer read or write anything.
 */
export async function deleteAccount(port: AccountPort, rawPhrase: unknown): Promise<ActionResult> {
  if (!isDeletePhrase(rawPhrase)) return { ok: false, error: `Type ${DELETE_PHRASE} to confirm.` };
  try {
    await port.deleteMyAccount();
  } catch {
    return { ok: false, error: "Your account was not deleted, and nothing has changed. Try again in a moment." };
  }
  await port.signOut().catch(() => undefined);
  return { ok: true };
}
