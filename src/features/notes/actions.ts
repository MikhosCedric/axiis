"use server";

import { refresh } from "next/cache";
import { getTimeZone } from "@/features/day/server";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";
import { deleteItem, setItemArea } from "@/features/detail/commands";
import type { ActionResult } from "@/features/today/commands";
import { createLinkedNote, createNote, linkItems, saveNote, searchItems, unlinkItems } from "./commands";
import type { Created, SearchRow } from "./model";

// Every repo is bound to the signed-in user's session and RLS scopes each
// query, so a direct POST without a session cannot reach anyone's rows.

function refreshed<R extends { ok: boolean }>(result: R): R {
  if (result.ok) refresh();
  return result;
}

export async function createNoteAction(): Promise<Created> {
  return createNote(await getNotesRepo());
}

/** No refresh: the editor already shows what it saved, and a re-render mid-typing would fight it. */
export async function saveNoteAction(id: string, content: { title: string; body: unknown }): Promise<ActionResult> {
  return saveNote(await getNotesRepo(), id, content?.title, content?.body);
}

export async function setNoteAreaAction(id: string, areaId: string | null): Promise<ActionResult> {
  return refreshed(await setItemArea(await getItemsRepo(), id, areaId, await getTimeZone()));
}

export async function deleteNoteAction(id: string): Promise<ActionResult> {
  return deleteItem(await getItemsRepo(), id, await getTimeZone());
}

export async function searchItemsAction(query: string): Promise<SearchRow[]> {
  return searchItems(await getNotesRepo(), query);
}

export async function linkItemsAction(fromId: string, toId: string): Promise<ActionResult> {
  return refreshed(await linkItems(await getNotesRepo(), fromId, toId));
}

export async function unlinkItemsAction(linkId: string): Promise<ActionResult> {
  return refreshed(await unlinkItems(await getNotesRepo(), linkId));
}

export async function createLinkedNoteAction(itemId: string): Promise<Created> {
  const [notes, items] = await Promise.all([getNotesRepo(), getItemsRepo()]);
  return createLinkedNote(notes, items, itemId);
}
