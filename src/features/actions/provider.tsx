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
import { canDo, deleteKind, rowKeyAction, type Box, type QuickAction, type QuickItem } from "./model";
import { focusTarget, QuickContext, renameKey, type LayerKind, type RowEntry, type OpenLayer, type Patch, type Quick, type QuickActions, type QuickArea, type RowHooks } from "./context";

/**
 * The server actions, loaded the first time one is called (`server-actions.ts`): their references are
 * unique ids that do not compress, and no page needs them to draw. Every call is awaited anyway.
 */
const loadServer = () => import("./server-actions").then((m) => m.serverActions);
const serverActions = new Proxy({} as QuickActions, {
  get: (_, name: keyof QuickActions) =>
    async (...args: unknown[]) => ((await loadServer())[name] as (...a: unknown[]) => Promise<unknown>)(...args),
});

const loadLayer = () => import("./layer");

// One empty map for every render: a new one each time would change the context on every render, and a
// change that reaches a part of the page still streaming in makes React draw it again beside the streamed copy.
const NO_PATCHES: ReadonlyMap<string, Patch> = new Map();

const noSubscribe = () => () => {};
const layerHost = () => document.getElementById("main") ?? document.body;
const noHost = () => null;
const Layer = lazy(loadLayer);
const Bulk = lazy(() => import("./bulk"));


function rowOf(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>("[data-quick]") ?? null;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
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
  const [overlay, patch] = useOptimistic(NO_PATCHES, (now, [key, p]: [string, Patch]) =>
    new Map(now).set(key, { ...now.get(key), ...p }),
  );
  const [note, setNote] = useState<UndoNote | null>(null);
  const [layer, setLayer] = useState<OpenLayer | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlyMap<string, RowEntry>>(() => new Map());
  const [selecting, setSelecting] = useState(false);
  const lastPicked = useRef<HTMLElement | null>(null);
  // The actions as of the last render, for code that runs later: the gesture listeners and a delete's Undo.
  const self = useRef<Quick | null>(null);
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

  // Which rows a click or X chooses is worked out by the layer's code, loaded on the first choice.
  const pick = useCallback((row: HTMLElement, how: "toggle" | "range") => {
    const before = lastPicked.current;
    lastPicked.current = row;
    void loadLayer().then((m) => setPicked((now) => m.picking(now, row, how, before)));
  }, []);

  const clearPicked = useCallback(() => {
    setPicked(new Map());
    setSelecting(false);
    lastPicked.current = null;
  }, []);


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


  const batch = useCallback(
    (patches: [string, Patch][], work: () => Promise<{ news: string; undo?: () => void }>) => {
      startTransition(async () => {
        for (const p of patches) patch(p);
        const { news, undo } = await reach(work()).then((done) => ("ok" in done ? { news: done.error } : done));
        tell(news, undo);
      });
    },
    [patch, tell],
  );

  // The row leaves at once; what the delete did, and its Undo, are worked out by the layer's code.
  const remove = useCallback(
    (item: QuickItem, scope: "one" | "all", row: HTMLElement | null) => {
      const section = row?.closest("section[aria-labelledby]")?.getAttribute("aria-labelledby") ?? null;
      focusNeighbour(row);
      batch([[item.key, { hidden: true }]], () => loadLayer().then((m) => m.removeItem(self.current!, item, scope, section)));
    },
    [batch],
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
      if (action === "pick") {
        e.preventDefault();
        pick(e.currentTarget, "toggle");
        return true;
      }
      if (!action || !canDo(item, action)) return false;
      e.preventDefault();
      run(action === "more" ? "more" : action, item, hooks, e.currentTarget);
      return true;
    },
    [run, pick],
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


  const choosing = picked.size > 0 || selecting;
  // Shift, Ctrl or Cmd with a click chooses rows, as does any tap in Select mode. Beams, chips and marks
  // answer a tap through their own pointer handling, so they are chosen with X instead.
  useEffect(() => {
    function onClick(e: globalThis.MouseEvent) {
      const quick = self.current;
      const target = e.target as HTMLElement;
      const row = target.closest<HTMLElement>("[data-quick]:not([role=button])");
      if (!quick || !row || target.closest("[data-quick-cluster], [popover], input, textarea, label")) return;
      if (!(e.shiftKey || e.ctrlKey || e.metaKey || quick.picked.size > 0 || quick.selecting)) return;
      e.preventDefault();
      e.stopPropagation();
      quick.pick(row, e.shiftKey ? "range" : "toggle");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The layer's code loads once the page is idle, so the menus open at once; it also listens for the Escape
  // that lets chosen rows go, and on a touch screen starts the swipes and long presses (gestures.ts).
  useEffect(() => {
    let detach: (() => void) | undefined;
    let live = true;
    const timer = window.setTimeout(() => {
      void loadLayer().then((m) => {
        if (live) detach = m.listen(self);
      });
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(timer);
      detach?.();
    };
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
      picked,
      pick,
      clearPicked,
      selecting,
      setSelecting,
      batch,
    }),
    [areas, today, actions, overlay, renaming, layer, run, open, close, keyDown, contextMenu, commitRename, stopRenaming, save, remove, tell, prefetch, picked, pick, clearPicked, selecting, batch],
  );
  useEffect(() => {
    self.current = value;
  });

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
            {choosing && (
              <Suspense fallback={null}>
                <Bulk />
              </Suspense>
            )}
            <UndoToast note={note} onDone={() => setNote(null)} />
          </>,
          host,
        )}
    </QuickContext.Provider>
  );
}
