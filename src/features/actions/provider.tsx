"use client";

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { AreaColor } from "@/domain/area-color";
import type { LocalDate } from "@/domain/item";
import { UndoToast, type UndoNote } from "@/components/undo-toast";
import { isTypingTarget } from "@/features/day/nav";
import type { DeleteResult } from "@/features/detail/commands";
import type { TimeOfDay, TypeChoice } from "@/features/detail/model";
import type { PlanFor } from "@/features/inbox/model";
import { sequencePending } from "@/features/palette/sequence";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";
import { clearTimeAction, deleteItemAction, renameItemAction, restoreOccurrenceAction, setAreaAction, setTimeAction, setTypeAction, unplanAction } from "@/features/detail/actions";
import { planAction } from "@/features/inbox/actions";
import { addTagAction, removeTagAction } from "@/features/tags/actions";
import { setDoneAction } from "@/features/today/actions";
import { duplicateItemAction, restoreItemsAction, tagChoicesAction } from "./actions";
import type { DuplicateResult, TagChoices } from "./commands";
import { canDo, deleteKind, rowKeyAction, type Box, type QuickAction, type QuickItem } from "./model";

/** The writes behind the quick actions. The app passes server actions; a dev harness passes in-memory ones. */
export type QuickActions = {
  setDone: (key: string, done: boolean) => Promise<ActionResult>;
  rename: (key: string, title: string) => Promise<ActionResult>;
  plan: (key: string, when: PlanFor) => Promise<ActionResult>;
  unplan: (key: string) => Promise<ActionResult>;
  setTime: (key: string, time: TimeOfDay) => Promise<ActionResult>;
  clearTime: (key: string) => Promise<ActionResult>;
  setArea: (key: string, areaId: string | null) => Promise<ActionResult>;
  addTag: (key: string, name: string) => Promise<ActionResult>;
  removeTag: (key: string, name: string) => Promise<ActionResult>;
  remove: (key: string, scope?: "one" | "all") => Promise<DeleteResult>;
  restore: (ids: string[]) => Promise<ActionResult>;
  /** Brings back a skipped occurrence, by its occurrence key. */
  unskip: (key: string) => Promise<ActionResult>;
  duplicate: (key: string) => Promise<DuplicateResult>;
  setType: (key: string, type: TypeChoice) => Promise<ActionResult>;
  /** The item's tags and every tag, or null when the item is gone. */
  tagChoices: (key: string) => Promise<TagChoices | null>;
};

const serverActions: QuickActions = {
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
  setType: setTypeAction,
  tagChoices: tagChoicesAction,
};

export type QuickArea = { id: string; name: string; color: AreaColor | null };

/** What a view tells the actions about one row: how to open it, and its own done box when it has one. */
export type RowHooks = {
  onOpen: () => void;
  /** The view's own tick, which keeps its optimistic state and news. Without one, the actions tick it. */
  onToggleDone?: () => void;
  /** The row draws its own done box, so the cluster leaves Done out. */
  doneBox?: boolean;
  /** The title can turn into a field in place. Beams, chips and marks rename in a popover instead. */
  inlineRename?: boolean;
  /** False where Delete and Backspace already mean "back to the Inbox" (the Score and the Week). */
  deleteKeys?: boolean;
};

export type LayerKind = "more" | "context" | "plan" | "labels" | "delete" | "delete-all" | "rename";

/** What is open over the page: a menu or a popover, for one item, placed at `at`. */
export type OpenLayer = { kind: LayerKind; item: QuickItem; hooks: RowHooks; at: Box; row: HTMLElement | null };

type Patch = { hidden?: boolean; title?: string; done?: boolean };

export type Quick = {
  areas: readonly QuickArea[];
  today: LocalDate;
  actions: QuickActions;
  /** The change in flight for an item, drawn before the save answers and dropped if it fails. */
  patched: (key: string) => Patch | undefined;
  renaming: string | null;
  /** Runs a row action: a button in the cluster, a key, or an entry in a menu. */
  run: (action: QuickAction, item: QuickItem, hooks: RowHooks, from: HTMLElement) => void;
  open: (kind: LayerKind, item: QuickItem, hooks: RowHooks, at: Box, row: HTMLElement | null) => void;
  close: (refocus?: boolean) => void;
  /** The keys on a row in focus. Returns whether it used the key. */
  keyDown: (e: KeyboardEvent<HTMLElement>, item: QuickItem, hooks: RowHooks) => boolean;
  contextMenu: (e: MouseEvent<HTMLElement>, item: QuickItem, hooks: RowHooks) => void;
  commitRename: (item: QuickItem, title: string, row: HTMLElement | null) => void;
  stopRenaming: (row: HTMLElement | null) => void;
  /** Saves with the change drawn at once, says how it went, and offers `undo` when given. */
  save: (item: QuickItem, patch: Patch, call: () => Promise<ActionResult>, news?: string | null, undo?: () => void) => void;
  remove: (item: QuickItem, scope: "one" | "all", row: HTMLElement | null) => void;
  tell: (text: string, undo?: () => void) => void;
  prefetch: () => void;
};

const QuickContext = createContext<Quick | null>(null);

/** The quick actions, or null on a page drawn without them (a dev harness that does not wrap its view). */
export function useQuick(): Quick | null {
  return useContext(QuickContext);
}

const loadLayer = () => import("./layer");
const Layer = lazy(loadLayer);

/** The element a row is reached by from the keyboard: the row itself when it takes focus, else its first control. */
export function focusTarget(row: HTMLElement): HTMLElement | null {
  if (row.matches("[tabindex], button, a[href]")) return row;
  return row.querySelector<HTMLElement>("[data-quick-focus]") ?? row.querySelector<HTMLElement>("button, a[href], [tabindex='0']");
}

function rowOf(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>("[data-quick]") ?? null;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Puts focus on the row for `key` once it is drawn again (after an undo brings it back), for up to a second. */
function focusWhenBack(key: string) {
  let tries = 0;
  const look = () => {
    const row = document.querySelector<HTMLElement>(`[data-quick="${CSS.escape(key)}"]`);
    const target = row && focusTarget(row);
    if (target) target.focus();
    else if (++tries < 40) setTimeout(look, 25);
  };
  setTimeout(look, 0);
}

/** Moves focus off a row about to leave: to the next row, else the one before. */
function focusNeighbour(row: HTMLElement | null) {
  if (!row || !row.contains(document.activeElement)) return;
  const rows = [...document.querySelectorAll<HTMLElement>("[data-quick]")];
  const at = rows.indexOf(row);
  const next = rows[at + 1] ?? rows[at - 1];
  (next && focusTarget(next))?.focus();
}

export function QuickActionsProvider({
  areas,
  today,
  actions = serverActions,
  children,
}: {
  areas: readonly QuickArea[];
  today: LocalDate;
  actions?: QuickActions;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();
  const [overlay, patch] = useOptimistic(new Map<string, Patch>(), (now, [key, p]: [string, Patch]) =>
    new Map(now).set(key, { ...now.get(key), ...p }),
  );
  const [note, setNote] = useState<UndoNote | null>(null);
  const [layer, setLayer] = useState<OpenLayer | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const notes = useRef(0);
  const layerRef = useRef(layer);
  // A row whose title field just closed: focus goes back to its title once it is drawn again.
  const refocusRow = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const row = refocusRow.current;
    if (!row) return;
    refocusRow.current = null;
    focusTarget(row)?.focus();
  });
  useEffect(() => {
    layerRef.current = layer;
  });

  const tell = useCallback((text: string, undo?: () => void) => setNote({ id: ++notes.current, text, undo }), []);
  const prefetch = useCallback(() => void loadLayer(), []);

  const save = useCallback(
    (item: QuickItem, p: Patch, call: () => Promise<ActionResult>, news?: string | null, undo?: () => void) => {
      startTransition(async () => {
        if (Object.keys(p).length) patch([item.key, p]);
        const result = await reach(call());
        if (!result.ok) tell(result.error);
        else if (news) tell(news, undo);
      });
    },
    [patch, tell],
  );

  const remove = useCallback(
    (item: QuickItem, scope: "one" | "all", row: HTMLElement | null) => {
      focusNeighbour(row);
      startTransition(async () => {
        patch([item.key, { hidden: true }]);
        const result = await reach(actions.remove(item.key, scope));
        if (!result.ok) {
          tell(result.error);
          return;
        }
        const back = () =>
          startTransition(async () => {
            const undone = await reach(result.skipped ? actions.unskip(result.skipped) : actions.restore(result.deleted));
            if (!undone.ok) tell(undone.error);
            else {
              tell(result.skipped ? `${item.title} is back on its day.` : `${item.title} is back.`);
              focusWhenBack(item.key);
            }
          });
        tell(result.skipped ? `${item.title} is skipped on this day.` : scope === "all" ? `${item.title} is deleted, every time.` : `${item.title} is deleted.`, back);
      });
    },
    [actions, patch, tell],
  );

  const open = useCallback((kind: LayerKind, item: QuickItem, hooks: RowHooks, at: Box, row: HTMLElement | null) => {
    setLayer({ kind, item, hooks, at, row });
  }, []);

  const close = useCallback((refocus = true) => {
    const was = layerRef.current;
    setLayer(null);
    if (refocus && was?.row?.isConnected) focusTarget(was.row)?.focus();
  }, []);

  const run = useCallback(
    (action: QuickAction, item: QuickItem, hooks: RowHooks, from: HTMLElement) => {
      if (!canDo(item, action)) return;
      const row = rowOf(from) ?? from;
      const at = boxOf(from);
      switch (action) {
        case "done":
          if (hooks.onToggleDone) hooks.onToggleDone();
          else {
            const done = !(overlay.get(item.key)?.done ?? item.done);
            save(item, { done }, () => actions.setDone(item.key, done), done ? `${item.title} is done.` : `${item.title} is open again.`);
          }
          return;
        case "rename":
          if (hooks.inlineRename) setRenaming(item.key);
          else open("rename", item, hooks, boxOf(row), row);
          return;
        case "delete":
          if (deleteKind(item) === "now") remove(item, "one", row);
          else open("delete", item, hooks, at, row);
          return;
        default:
          open(action, item, hooks, at, row);
      }
    },
    [actions, open, overlay, remove, save],
  );

  const keyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>, item: QuickItem, hooks: RowHooks) => {
      const target = e.target as HTMLElement;
      // Only from the row's own focus target: a key in its cluster is that button's own.
      if (target.closest("[data-quick-cluster]")) return false;
      const action = rowKeyAction(
        {
          key: e.key,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          typing: isTypingTarget(target),
          defaultPrevented: e.defaultPrevented,
          sequence: sequencePending(),
        },
        hooks.deleteKeys ?? true,
      );
      if (!action || !canDo(item, action)) return false;
      e.preventDefault();
      run(action === "more" ? "more" : action, item, hooks, e.currentTarget);
      return true;
    },
    [run],
  );

  const contextMenu = useCallback(
    (e: MouseEvent<HTMLElement>, item: QuickItem, hooks: RowHooks) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
      loadLayer();
      // A menu key press arrives as a contextmenu event at 0,0; open it on the row instead.
      const point = e.clientX === 0 && e.clientY === 0 ? boxOf(e.currentTarget) : { left: e.clientX, top: e.clientY, width: 0, height: 0 };
      open("context", item, hooks, point, e.currentTarget);
    },
    [open],
  );

  const commitRename = useCallback(
    (item: QuickItem, title: string, row: HTMLElement | null) => {
      setRenaming(null);
      refocusRow.current = row;
      const next = title.trim();
      if (!next || next === item.title) return;
      save(item, { title: next }, () => actions.rename(item.key, next));
    },
    [actions, save],
  );

  const stopRenaming = useCallback((row: HTMLElement | null) => {
    setRenaming(null);
    refocusRow.current = row;
  }, []);

  const value = useMemo<Quick>(
    () => ({
      areas,
      today,
      actions,
      patched: (key) => overlay.get(key),
      renaming,
      run,
      open,
      close,
      keyDown,
      contextMenu,
      commitRename,
      stopRenaming,
      save,
      remove,
      tell,
      prefetch,
    }),
    [areas, today, actions, overlay, renaming, run, open, close, keyDown, contextMenu, commitRename, stopRenaming, save, remove, tell, prefetch],
  );

  return (
    <QuickContext.Provider value={value}>
      {children}
      {layer && (
        <Suspense fallback={null}>
          <Layer key={`${layer.kind}-${layer.item.key}`} layer={layer} />
        </Suspense>
      )}
      <UndoToast note={note} onDone={() => setNote(null)} />
    </QuickContext.Provider>
  );
}
