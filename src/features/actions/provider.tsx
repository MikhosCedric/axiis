"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { LocalDate } from "@/domain/item";
import { UndoToast, type UndoNote } from "@/components/undo-toast";
import { isTypingTarget } from "@/features/day/nav";
import { sequencePending } from "@/features/palette/sequence";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";
import { clearTimeAction, deleteItemAction, renameItemAction, restoreOccurrenceAction, setAreaAction, setTimeAction, setTypeAction, unplanAction } from "@/features/detail/actions";
import { planAction } from "@/features/inbox/actions";
import { addTagAction, removeTagAction } from "@/features/tags/actions";
import { setDoneAction } from "@/features/today/actions";
import { duplicateItemAction, restoreItemsAction, tagChoicesAction } from "./actions";
import { canDo, deleteKind, rowKeyAction, type Box, type QuickAction, type QuickItem } from "./model";
import { QuickContext, renameKey, type LayerKind, type OpenLayer, type Patch, type Quick, type QuickActions, type QuickArea, type RowHooks } from "./context";

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

const loadLayer = () => import("./layer");

const noSubscribe = () => () => {};
const layerHost = () => document.getElementById("main") ?? document.body;
const noHost = () => null;
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

/**
 * Puts focus on the row for `key` once it is drawn again (after an undo brings it back), for up to a
 * second, in the section it was in: one item can be drawn twice on a page (Next up and the List).
 */
function focusWhenBack(key: string, section: string | null) {
  let tries = 0;
  const look = () => {
    const within = (section && document.querySelector(`section[aria-labelledby="${CSS.escape(section)}"]`)) || document;
    const row = within.querySelector<HTMLElement>(`[data-quick="${CSS.escape(key)}"]`);
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
  const host = useSyncExternalStore(noSubscribe, layerHost, noHost);
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
      const section = row?.closest("section[aria-labelledby]")?.getAttribute("aria-labelledby") ?? null;
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
              focusWhenBack(item.key, section);
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
          if (hooks.inlineRename) setRenaming(renameKey(hooks.inlineRename, item.key));
          else open("rename", item, hooks, boxOf(row), row);
          return;
        case "delete":
          if (deleteKind(item) === "now") remove(item, "one", row);
          else open("delete", item, hooks, at, row);
          return;
        case "more":
          // Under a coarse pointer the cluster is only this button, so its menu holds every action.
          open(window.matchMedia("(pointer: coarse)").matches ? "context" : "more", item, hooks, at, row);
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
      openFor: (key) => (layer?.item.key === key ? layer.kind : null),
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
    [areas, today, actions, overlay, renaming, layer, run, open, close, keyDown, contextMenu, commitRename, stopRenaming, save, remove, tell, prefetch],
  );

  return (
    <QuickContext.Provider value={value}>
      {children}
      {/* Inside the page's main landmark, as everything on it must be; the layers float in the top layer anyway. */}
      {host &&
        createPortal(
          <>
            {layer && (
              <Suspense fallback={null}>
                <Layer key={`${layer.kind}-${layer.item.key}`} layer={layer} />
              </Suspense>
            )}
            <UndoToast note={note} onDone={() => setNote(null)} />
          </>,
          host,
        )}
    </QuickContext.Provider>
  );
}
