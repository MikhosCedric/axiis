"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { LocalDate, ShownItem } from "@/domain/item";
import { localMinutes } from "@/lib/dates";
import { changes, minutesAt, moveTo, resizeTo, slotFor, toAnyTime, toInbox, type Placement, type Slot } from "./grid-drop";

export type DragKind = "move" | "resize" | "create";

/** What a gesture would do right now: where an item would land, or the slot being drawn for a new one. */
export type DragPreview =
  | { kind: "move" | "resize"; item: ShownItem; placement: Placement | null }
  | { kind: "create"; item: null; slot: Slot };

type Gesture = {
  kind: DragKind;
  item: ShownItem | null;
  /** The day of the column the gesture began in: a resize's column, a new item's day. */
  day: LocalDate;
  /** Where on the day the press began, in minutes. */
  from: number;
  /** Minutes between the pointer and the item's start, so a moved block does not jump. */
  grab: number;
  el: HTMLElement;
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  touch: boolean;
  active: boolean;
  timer: number | null;
  placement: Placement | null;
  slot: Slot | null;
  shown: string;
  listeners: { move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: (e: PointerEvent) => void; key: (e: KeyboardEvent) => void };
};

type Live = {
  timeZone: string;
  /** The length a new item, or one that had no time, gets. */
  fallback: number;
  onDrop: (item: ShownItem, placement: Placement) => void;
  /** A press that never became a drag. */
  onTap: (item: ShownItem, from: HTMLElement) => void;
  /** Empty time was clicked or drawn over. */
  onSlot: (slot: Slot) => void;
};

const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
/** A touch has to rest this long before it picks something up, so a swipe still scrolls the grid. */
const LONG_PRESS_MS = 280;
const EDGE_PX = 36;
const EDGE_SPEED = 12;

const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

function detach(g: Gesture) {
  window.removeEventListener("pointermove", g.listeners.move);
  window.removeEventListener("pointerup", g.listeners.up);
  window.removeEventListener("pointercancel", g.listeners.cancel);
  window.removeEventListener("keydown", g.listeners.key, true);
  if (g.timer !== null) window.clearTimeout(g.timer);
}

const keyOf = (g: Gesture) => {
  if (g.slot) return `slot:${g.slot.day}:${g.slot.start}:${g.slot.length}`;
  const s = g.placement?.schedule;
  if (!s) return "";
  return s.kind === "timed" ? `${s.start.getTime()}-${s.end.getTime()}` : s.kind === "day" ? `day:${s.on}` : s.kind;
};

/**
 * Pointer and touch gestures on the grid: drag a block or an any-time item to move it, drag a block's
 * bottom edge to change its length, press or drag empty time for a new item. A mouse drags at once; a
 * touch must rest first (a plain touch scrolls). Escape puts a held item back. The day columns are found
 * by `data-day-col` and the any-time cells by `data-anytime` inside `scroller`.
 */
export function useGridDrag(scroller: RefObject<HTMLElement | null>, live: Live, setPreview: (preview: DragPreview | null) => void) {
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef(live);
  const frame = useRef<number | null>(null);

  useLayoutEffect(() => {
    latest.current = live;
  });

  const columns = () =>
    [...(scroller.current?.querySelectorAll<HTMLElement>("[data-day-col]") ?? [])].map((el) => ({
      date: el.dataset.dayCol as LocalDate,
      rect: el.getBoundingClientRect(),
    }));

  function columnAt(x: number) {
    const cols = columns();
    return cols.find((c) => x >= c.rect.left && x < c.rect.right) ?? (cols.length ? (x < cols[0].rect.left ? cols[0] : cols[cols.length - 1]) : null);
  }

  function track(g: Gesture) {
    const { timeZone, fallback } = latest.current;
    g.placement = null;
    g.slot = null;
    if (g.kind === "create") {
      const col = columns().find((c) => c.date === g.day);
      if (col) g.slot = slotFor(g.day, g.from, minutesAt(g.y - col.rect.top), fallback);
    } else if (g.kind === "resize") {
      const col = columns().find((c) => c.date === g.day);
      if (col) g.placement = resizeTo(g.item!, g.day, minutesAt(g.y - col.rect.top), timeZone);
    } else {
      const cell = [...(scroller.current?.querySelectorAll<HTMLElement>("[data-anytime]") ?? [])].find((el) =>
        inside(el.getBoundingClientRect(), g.x, g.y),
      );
      const col = columnAt(g.x);
      // The Inbox tray sits under the grid, outside what scrolls: a drop there takes the day away.
      const tray = scroller.current?.parentElement?.querySelector<HTMLElement>("[data-drop='tray']");
      const frame = scroller.current?.getBoundingClientRect();
      if (tray && inside(tray.getBoundingClientRect(), g.x, g.y)) g.placement = toInbox();
      // Something with no day yet is planned only where it is dropped, never by the nearest edge.
      else if (g.item!.schedule.kind === "unscheduled" && !(frame && inside(frame, g.x, g.y))) g.placement = null;
      else if (cell) g.placement = toAnyTime(cell.dataset.anytime as LocalDate);
      else if (col) g.placement = moveTo(g.item!, col.date, minutesAt(g.y - col.rect.top) - g.grab, timeZone, fallback);
    }
    const key = keyOf(g);
    if (key === g.shown) return;
    g.shown = key;
    if (g.kind === "create") setPreview(g.slot ? { kind: "create", item: null, slot: g.slot } : null);
    else setPreview({ kind: g.kind, item: g.item!, placement: g.placement });
  }

  function autoScroll() {
    frame.current = null;
    const g = gesture.current;
    const el = scroller.current;
    if (!g?.active || !el) return;
    const r = el.getBoundingClientRect();
    const step = g.y < r.top + EDGE_PX ? -EDGE_SPEED : g.y > r.bottom - EDGE_PX ? EDGE_SPEED : 0;
    if (step === 0) return;
    const before = el.scrollTop;
    el.scrollTop += step;
    if (el.scrollTop !== before) track(g);
    frame.current = requestAnimationFrame(autoScroll);
  }

  function activate(g: Gesture) {
    g.active = true;
    g.timer = null;
    document.documentElement.dataset.scoreDragging = "";
    g.shown = "\u0000";
    track(g);
  }

  function finish(commit: boolean) {
    const g = gesture.current;
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    delete document.documentElement.dataset.scoreDragging;
    if (!g) return;
    detach(g);
    setPreview(null);
    if (!commit) return;
    const { onTap, onSlot, onDrop, fallback } = latest.current;
    // What opens a popover waits for this press to end: opened inside it, the browser would take the same
    // press for a click outside the popover and close it at once.
    if (g.kind === "create") {
      const slot = g.active && g.slot ? g.slot : slotFor(g.day, g.from, g.from, fallback);
      window.setTimeout(() => onSlot(slot), 0);
    } else if (!g.active) {
      if (g.kind === "move") window.setTimeout(() => onTap(g.item!, g.el), 0);
    } else if (g.placement && changes(g.item!, g.placement)) {
      onDrop(g.item!, g.placement);
    }
  }

  function onMove(e: PointerEvent) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    g.x = e.clientX;
    g.y = e.clientY;
    if (!g.active) {
      const moved = Math.hypot(g.x - g.x0, g.y - g.y0);
      // A touch that travels before the long press is a scroll; the grid keeps it.
      if (g.touch) {
        if (moved > TOUCH_SLOP) finish(false);
        return;
      }
      if (moved < MOUSE_SLOP) return;
      activate(g);
    }
    track(g);
    if (frame.current === null) frame.current = requestAnimationFrame(autoScroll);
  }

  function onUp(e: PointerEvent) {
    if (gesture.current && e.pointerId === gesture.current.pointerId) finish(true);
  }

  function onCancel(e: PointerEvent) {
    if (gesture.current && e.pointerId === gesture.current.pointerId) finish(false);
  }

  /** Escape drops what is held where it was, and is kept from closing a panel behind the drag. */
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !gesture.current) return;
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  }

  useEffect(() => {
    // While something is held by touch, stop the browser from turning the same finger into a scroll.
    const hold = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault();
    };
    document.addEventListener("touchmove", hold, { passive: false });
    return () => {
      document.removeEventListener("touchmove", hold);
      const g = gesture.current;
      if (g) detach(g);
      gesture.current = null;
      delete document.documentElement.dataset.scoreDragging;
    };
  }, []);

  /**
   * Begins a gesture from a pointer press. `day` is the day of the column pressed in; for an any-time item
   * (no column) it is the item's own day. Presses on the same element reach only the innermost handler.
   */
  function start(e: ReactPointerEvent<HTMLElement>, kind: DragKind, day: LocalDate, item: ShownItem | null) {
    if (e.button !== 0 || gesture.current) return;
    e.stopPropagation();
    const col = columns().find((c) => c.date === day);
    const from = col ? minutesAt(e.clientY - col.rect.top) : 0;
    const s = item?.schedule;
    const touch = e.pointerType === "touch";
    const g: Gesture = {
      kind,
      item,
      day,
      from,
      grab: kind === "move" && s?.kind === "timed" && col ? from - localMinutes(s.start, day, latest.current.timeZone) : 0,
      el: e.currentTarget,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      touch,
      active: false,
      timer: null,
      placement: null,
      slot: null,
      shown: "",
      listeners: { move: onMove, up: onUp, cancel: onCancel, key: onKey },
    };
    gesture.current = g;
    if (touch) g.timer = window.setTimeout(() => activate(g), LONG_PRESS_MS);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
  }

  return start;
}
