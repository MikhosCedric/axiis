import { cookies } from "next/headers";
import { TZ_COOKIE } from "@/components/shell/cookies";
import { createLinkedNoteAction } from "@/features/notes/actions";
import { linkedNotes } from "@/features/notes/commands";
import { setDoneAction } from "@/features/today/actions";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";
import { resolveTimeZone } from "@/lib/dates";
import { addSubtaskAction, deleteItemAction, promoteSubtaskAction, renameItemAction, setAreaAction } from "./actions";
import { loadDetail, parseItemId } from "./commands";
import { DetailSheet, MissingItem } from "./detail-sheet";
import type { DetailActions } from "./model";

const actions: DetailActions = {
  rename: renameItemAction,
  setDone: setDoneAction,
  setArea: setAreaAction,
  addSubtask: addSubtaskAction,
  promote: promoteSubtaskAction,
  remove: deleteItemAction,
  newLinkedNote: createLinkedNoteAction,
};

/** Renders the selected item and its subtasks, or nothing when no item is selected. */
export async function DetailPanel({ itemId }: { itemId: string | null }) {
  const id = parseItemId(itemId);
  if (!id) return null;
  const [repo, notes, jar] = await Promise.all([getItemsRepo(), getNotesRepo(), cookies()]);
  const [view, linked] = await Promise.all([
    loadDetail(repo, id, resolveTimeZone(jar.get(TZ_COOKIE)?.value)),
    linkedNotes(notes, id),
  ]);
  if (!view) return <MissingItem />;
  return <DetailSheet key={view.item.id} view={view} actions={actions} linkedNotes={linked} />;
}
