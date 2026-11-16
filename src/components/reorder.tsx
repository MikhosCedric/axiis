"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { moved } from "@/lib/items/order";

/** One row that can be moved: its id and the words it is called by. */
export type ReorderRow = { id: string; title: string };

/** What a move did: the row, and the place it now has among the rows it can move between. */
export type ReorderMove = { id: string; title: string; place: number; of: number };

type Drag = { id: string; to: number };

const ROW = "[data-reorder-row]";

/** "Oats moved to 2 of 5." */
export const movedWords = (move: ReorderMove) => `${move.title} moved to ${move.place} of ${move.of}.`;

/**
 * Manual order for a list of rows, by a drag on a row's handle and by Alt with Up or Down from anywhere in the row
 * (plain Up and Down on the handle itself). The caller keeps the rows and saves the order; this works out the move.
 *
 * `groupOf` keeps a row among its own kind (open rows before done ones, say): it moves only between rows of its group.
 * Spread `row(id)` on each row's element and draw a `ReorderHandle` with `handle(row)` inside it. `said` is the last
 * move in words, for a live region, and `hintId` names the handle's instructions, which `ReorderHint` renders.
 */
export function useReorder({
  rows,
  groupOf,
  onMove,
}: {
  rows: readonly ReorderRow[];
  groupOf?: (id: string) => string;
  onMove: (ids: string[], move: ReorderMove) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [said, setSaid] = useState("");
  const hintId = useId();
  const dragging = useRef<{ id: string; pointerId: number; to: number; rows: HTMLElement[] } | null>(null);
  // The element that held focus when a key moved its row: moving a node can drop focus, so it is given back.
  const keep = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = keep.current;
    keep.current = null;
    if (el?.isConnected && document.activeElement !== el) el.focus({ preventScroll: true });
  });

  const group = (id: string) => groupOf?.(id) ?? "";
  /** Indexes, in `rows`, of the rows `id` may move between. */
  const peers = (id: string) => rows.flatMap((r, i) => (group(r.id) === group(id) ? [i] : []));

  /** Moves `id` to place `to` (from 0) among its peers. False when it is there already or cannot go. */
  function moveTo(id: string, to: number): boolean {
    const among = peers(id);
    const from = among.findIndex((i) => rows[i].id === id);
    if (from < 0 || to < 0 || to >= among.length || to === from) return false;
    const ids = moved(rows.map((r) => r.id), among[from], among[to]);
    const move = { id, title: rows[among[from]].title, place: to + 1, of: among.length };
    setSaid(movedWords(move));
    onMove(ids, move);
    return true;
  }

  /** Whether `id` is first or last among the rows it can move between. */
  function edge(id: string) {
    const among = peers(id);
    const from = among.findIndex((i) => rows[i].id === id);
    return { first: from <= 0, last: from < 0 || from === among.length - 1 };
  }

  /** One place up (-1) or down (1), for a button. Focus stays where it is. */
  function move(id: string, by: 1 | -1) {
    const from = peers(id).findIndex((i) => rows[i].id === id);
    if (moveTo(id, from + by)) keep.current = document.activeElement as HTMLElement | null;
  }

  function step(e: KeyboardEvent<HTMLElement>, id: string) {
    const among = peers(id);
    const from = among.findIndex((i) => rows[i].id === id);
    e.preventDefault();
    e.stopPropagation();
    if (moveTo(id, from + (e.key === "ArrowDown" ? 1 : -1))) keep.current = document.activeElement as HTMLElement | null;
    else if (from >= 0) setSaid(`${rows[among[from]].title} is ${e.key === "ArrowDown" ? "last" : "first"} already.`);
  }

  /** Where the pointer would drop the dragged row: the count of its peers whose middle is above it. */
  function placeAt(y: number) {
    const d = dragging.current!;
    return d.rows.filter((el) => el.dataset.reorderRow !== d.id && y > el.getBoundingClientRect().top + el.offsetHeight / 2).length;
  }

  function end(commit: boolean) {
    const d = dragging.current;
    dragging.current = null;
    setDrag(null);
    if (d && commit) moveTo(d.id, d.to);
  }

  function row(id: string) {
    const among = drag ? peers(drag.id).map((i) => rows[i].id) : [];
    const rest = among.filter((p) => p !== drag?.id);
    const from = drag ? among.indexOf(drag.id) : -1;
    // The line is drawn on the row the dragged one would land beside; nothing is drawn where it would not move.
    let drop: "before" | "after" | undefined;
    if (drag && drag.to !== from) {
      if (rest[drag.to] === id) drop = "before";
      else if (drag.to === rest.length && rest[rest.length - 1] === id) drop = "after";
    }
    return {
      "data-reorder-row": id,
      "data-reorder-group": group(id),
      "data-reorder-lifted": drag?.id === id ? "" : undefined,
      "data-reorder-drop": drop,
    };
  }

  /** Alt with Up or Down, from anything in the row that is not being typed in. True when the key was taken. */
  function rowKeyDown(e: KeyboardEvent<HTMLElement>, id: string): boolean {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return false;
    const target = e.target as HTMLElement;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return false;
    }
    step(e, id);
    return true;
  }

  function handle(r: ReorderRow) {
    return {
      title: r.title,
      hintId,
      lifted: drag?.id === r.id,
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.ctrlKey && !e.metaKey && !e.shiftKey) step(e, r.id);
      },
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0 || dragging.current) return;
        const list = e.currentTarget.closest<HTMLElement>(ROW)?.parentElement;
        if (!list) return;
        // A drag on the handle selects no text and starts no scroll; the handle still takes focus, for the keys.
        e.preventDefault();
        e.currentTarget.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        const mine = group(r.id);
        const peerRows = Array.from(list.querySelectorAll<HTMLElement>(ROW)).filter(
          (el) => el.parentElement === list && el.dataset.reorderGroup === mine,
        );
        const to = peerRows.findIndex((el) => el.dataset.reorderRow === r.id);
        dragging.current = { id: r.id, pointerId: e.pointerId, to, rows: peerRows };
        setDrag({ id: r.id, to });
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const d = dragging.current;
        if (!d || e.pointerId !== d.pointerId) return;
        const to = placeAt(e.clientY);
        if (to === d.to) return;
        d.to = to;
        setDrag({ id: d.id, to });
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        if (dragging.current?.pointerId === e.pointerId) end(true);
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
        if (dragging.current?.pointerId === e.pointerId) end(false);
      },
    };
  }

  // Escape drops the row where it was, and is kept from closing a panel behind the drag. Listening only while a drag lasts.
  const stop = useRef(end);
  useEffect(() => {
    stop.current = end;
  });
  const lifted = drag !== null;
  useEffect(() => {
    if (!lifted) return;
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || !dragging.current) return;
      e.preventDefault();
      e.stopPropagation();
      stop.current(false);
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [lifted]);

  return { row, rowKeyDown, handle, edge, move, said, hintId, dragging: drag !== null };
}

type HandleProps = ReturnType<ReturnType<typeof useReorder>["handle"]>;

/** The grip a row is dragged by. A button, so it takes focus: Up and Down on it move the row. */
export function ReorderHandle({ title, hintId, lifted, className = "", ...events }: HandleProps & { className?: string }) {
  return (
    <button
      type="button"
      data-reorder-handle
      aria-label={`Move ${title}`}
      aria-describedby={hintId}
      title="Drag to move, or Alt with Up or Down"
      className={`grid h-8 w-6 flex-none cursor-grab touch-none pointer-coarse:w-11 place-items-center rounded-md text-ink-3 select-none hover:bg-hover hover:text-ink active:cursor-grabbing pointer-coarse:h-11 ${lifted ? "bg-press text-ink" : ""} ${className}`}
      {...events}
    >
      <svg viewBox="0 0 10 16" width={10} height={16} aria-hidden="true" fill="currentColor">
        {[3, 8, 13].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.25} />))}
      </svg>
    </button>
  );
}

/** The handles' instructions, read after a handle's name, and the last move, read as it happens when `say` is set. */
export function ReorderHint({ id, said, say = true }: { id: string; said: string; say?: boolean }) {
  return (
    <>
      <p id={id} className="sr-only">
        Up and Down move it. From anywhere in its row, Alt with Up or Down does the same.
      </p>
      <p aria-live="polite" className="sr-only">
        {say ? said : ""}
      </p>
    </>
  );
}
