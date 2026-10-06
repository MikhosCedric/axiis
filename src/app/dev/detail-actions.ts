import {
  addSubtask,
  clearTime,
  deleteItem,
  promoteSubtask,
  renameItem,
  setFirstDay,
  setItemArea,
  setRepeat,
  setTime,
  stopRepeating,
} from "@/features/detail/commands";
import type { DetailActions } from "@/features/detail/model";
import { addTag, removeTag } from "@/features/tags/commands";
import { setDone, type ActionResult } from "@/features/today/commands";
import type { ItemsRepo } from "@/lib/items/repo";

/**
 * The detail sheet's writes for a dev harness, through the real commands over
 * an in-memory repo. `run` wraps each one, to add latency, fail on demand or
 * reload after a save. Linked notes need a notes store, so each harness adds
 * `newLinkedNote` itself.
 */
export function harnessDetailActions(
  repo: ItemsRepo,
  timeZone: string,
  run: (command: () => Promise<ActionResult>) => Promise<ActionResult>,
): Omit<DetailActions, "newLinkedNote"> {
  return {
    rename: (key, title, scope) => run(() => renameItem(repo, key, title, timeZone, scope)),
    setDone: (key, done) => run(() => setDone(repo, key, done, timeZone)),
    setArea: (key, area, scope) => run(() => setItemArea(repo, key, area, timeZone, scope)),
    setTime: (key, time, scope) => run(() => setTime(repo, key, time, timeZone, scope)),
    clearTime: (key, scope) => run(() => clearTime(repo, key, timeZone, scope)),
    setFirstDay: (key, on) => run(() => setFirstDay(repo, key, on, timeZone)),
    addSubtask: (parent, title) => run(() => addSubtask(repo, parent, title)),
    promote: (key) => run(() => promoteSubtask(repo, key)),
    remove: (key, scope) => run(() => deleteItem(repo, key, timeZone, scope)),
    setRepeat: (key, choice) => run(() => setRepeat(repo, key, choice, new Date(), timeZone)),
    stopRepeating: (key) => run(() => stopRepeating(repo, key, timeZone)),
    addTag: (key, name) => run(() => addTag(repo, key, name, timeZone)),
    removeTag: (key, name) => run(() => removeTag(repo, key, name, timeZone)),
  };
}
