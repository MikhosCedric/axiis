"use client";

import { clearTimeAction, deleteItemAction, renameItemAction, restoreOccurrenceAction, setAreaAction, setTimeAction, setTypeAction, unplanAction } from "@/features/detail/actions";
import { planAction } from "@/features/inbox/actions";
import { createLinkedNoteAction } from "@/features/notes/actions";
import { addTagAction, removeTagAction } from "@/features/tags/actions";
import { setDoneAction } from "@/features/today/actions";
import { duplicateItemAction, restoreItemsAction, tagChoicesAction } from "./actions";
import type { QuickActions } from "./context";

export const serverActions: QuickActions = {
  setDone: setDoneAction,
  rename: renameItemAction,
  plan: planAction,
  unplan: unplanAction,
  setTime: setTimeAction,
  clearTime: clearTimeAction,
  setArea: setAreaAction,
  addTag: addTagAction,
  removeTag: removeTagAction,
  remove: deleteItemAction,
  restore: restoreItemsAction,
  unskip: restoreOccurrenceAction,
  duplicate: duplicateItemAction,
  addNote: createLinkedNoteAction,
  setType: setTypeAction,
  tagChoices: tagChoicesAction,
};
