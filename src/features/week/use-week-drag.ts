"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ShownItem, LocalDate } from "@/domain/item";
import { moves, readDropZone, type Destination } from "./model";

export type WeekDragPreview = { item: ShownItem; over: Destination | null };

type Gesture = {
  item: ShownItem;
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  touch: boolean;
  active: boolean;
  timer: number | null;
  over: Destination | null;
  /** The listeners this gesture added, so the same functions come off again. */
  listeners: {
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
    key: (e: KeyboardEvent) => void;
  };
};

type Live = {
  days: LocalDate[];
  timeZone: string;
  onDrop: (item: ShownItem, to: Destination) => void;
  onTap: (item: ShownItem) => void;
};

const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
/** Same hold as the Score: a touch has to rest before it picks an item up, so a swipe still scrolls. */
const LONG_PRESS_MS = 280;
const EDGE_PX = 56;
const EDGE_SPEED = 12;
const FLY_OFFSET = 14;

/**
 * Pointer and touch dragging between the week's days and the tray. Drop zones
 * are any element with a `data-drop` of a date in the week or `tray`; the
 * floating copy ignores the pointer so the zone under it can be read.
 */
export function useWeekDrag(fly: RefObject<HTMLDivElement | null>, live: Live, setPreview: (p: WeekDragPreview | null) => void) {
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef(live);
  const frame = useRef<number | null>(null);

  useLayoutEffect(() => {
    latest.current = live;
  });

  function zoneAt(g: Gesture): Destination | null {
    const zone = document.elementFromPoint(g.x, g.y)?.closest<HTMLElement>("[data-drop]");
    const to = readDropZone(zone?.dataset.drop, latest.current.days);
    return to && moves(g.item, to, latest.current.timeZone) ? to : null;
  }

  function track(g: Gesture) {
    const el = fly.current;
    if (el) el.style.transform = `translate(${g.x + FLY_OFFSET}px, ${g.y + FLY_OFFSET}px)`;
    const over = zoneAt(g);
    if (over !== g.over) {
      g.over = over;
      setPreview({ item: g.item, over });
    }
  }

  // Stacked days run past the screen on a phone, so holding an item near an edge scrolls the page.
  function autoScroll() {
    frame.current = null;
    const g = gesture.current;
    if (!g?.active) return;
    const step = g.y < EDGE_PX ? -EDGE_SPEED : g.y > window.innerHeight - EDGE_PX ? EDGE_SPEED : 0;
    if (step === 0) return;
    const before = window.scrollY;
    window.scrollBy(0, step);
    if (window.scrollY !== before) track(g);
    frame.current = requestAnimationFrame(autoScroll);
  }

  function activate(g: Gesture) {
    g.active = true;
    g.timer = null;
    document.documentElement.dataset.scoreDragging = "";
    setPreview({ item: g.item, over: null });
    track(g);
  }

  function detach(g: Gesture) {
    window.removeEventListener("pointermove", g.listeners.move);
    window.removeEventListener("pointerup", g.listeners.up);
    window.removeEventListener("pointercancel", g.listeners.cancel);
    window.removeEventListener("keydown", g.listeners.key, true);
    if (g.timer !== null) window.clearTimeout(g.timer);
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
    if (!g.active) latest.current.onTap(g.item);
    else if (g.over) latest.current.onDrop(g.item, g.over);
  }

  function onMove(e: PointerEvent) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    g.x = e.clientX;
    g.y = e.clientY;
    if (!g.active) {
      const moved = Math.hypot(g.x - g.x0, g.y - g.y0);
      // A touch that travels before the long press is a scroll; let the page have it.
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

  /** Escape drops a held item where it was. It is kept from closing a panel behind the drag. */
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !gesture.current) return;
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  }

  useEffect(() => {
    // While an item is held by touch, stop the browser from turning the same finger into a scroll.
    const hold = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault();
    };
    document.addEventListener("touchmove", hold, { passive: false });
    return () => {
      document.removeEventListener("touchmove", hold);
      const g = gesture.current;
      if (g) detach(g);
      delete document.documentElement.dataset.scoreDragging;
    };
  }, []);

  return function start(e: ReactPointerEvent<HTMLElement>, item: ShownItem) {
    if (e.button !== 0 || gesture.current) return;
    const touch = e.pointerType === "touch";
    const g: Gesture = {
      item,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      touch,
      active: false,
      timer: null,
      over: null,
      listeners: { move: onMove, up: onUp, cancel: onCancel, key: onKey },
    };
    gesture.current = g;
    if (touch) g.timer = window.setTimeout(() => activate(g), LONG_PRESS_MS);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
  };
}
