import { cookies } from "next/headers";
import { TZ_COOKIE } from "@/components/shell/cookies";
import { resolveTimeZone } from "@/lib/dates";
import {
  createNoteAction,
  deleteNoteAction,
  linkItemsAction,
  saveNoteAction,
  searchItemsAction,
  setNoteAreaAction,
  unlinkItemsAction,
} from "./actions";
import type { NotesActions } from "./model";

export const notesActions: NotesActions = {
  create: createNoteAction,
  save: saveNoteAction,
  setArea: setNoteAreaAction,
  remove: deleteNoteAction,
  search: searchItemsAction,
  link: linkItemsAction,
  unlink: unlinkItemsAction,
};

export async function requestTimeZone(): Promise<string> {
  return resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value);
}
