import { createLinkedNoteAction } from "@/features/notes/actions";
import { linkedNotes } from "@/features/notes/commands";
import { getTimeZone } from "@/features/day/server";
import { setDoneAction } from "@/features/today/actions";
import { addTagAction, removeTagAction } from "@/features/tags/actions";
import { parseItemKey } from "@/domain/item-key";
import { getItemsRepo } from "@/lib/items";
import { getNotesRepo } from "@/lib/notes";
import {
  addSubtaskAction,
  clearTimeAction,
  deleteItemAction,
  promoteSubtaskAction,
  renameItemAction,
  setAreaAction,
  setFirstDayAction,
  setRepeatAction,
  setTimeAction,
  stopRepeatingAction,
} from "./actions";
import { loadDetail } from "./commands";
import { DetailSheet, MissingItem } from "./detail-sheet";
import type { DetailActions } from "./model";

const actions: DetailActions = {
  rename: renameItemAction,
  setDone: setDoneAction,
  setArea: setAreaAction,
  setTime: setTimeAction,
  clearTime: clearTimeAction,
  setFirstDay: setFirstDayAction,
  addSubtask: addSubtaskAction,
  promote: promoteSubtaskAction,
  remove: deleteItemAction,
  setRepeat: setRepeatAction,
  stopRepeating: stopRepeatingAction,
  addTag: addTagAction,
  removeTag: removeTagAction,
  newLinkedNote: createLinkedNoteAction,
};

/** Renders the selected item, or one occurrence of a repeating item, or nothing when nothing is selected. */
export async function DetailPanel({ itemId }: { itemId: string | null }) {
  const key = parseItemKey(itemId);
  if (!key) return null;
  const [repo, notes, timeZone] = await Promise.all([getItemsRepo(), getNotesRepo(), getTimeZone()]);
  const view = await loadDetail(repo, key, timeZone);
  if (!view) return <MissingItem />;
  const linked = await linkedNotes(notes, view.notesFor);
  return <DetailSheet key={view.item.id} view={view} actions={actions} linkedNotes={linked} />;
}
