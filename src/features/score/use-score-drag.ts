"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ShownItem } from "@/domain/item";
import { anyTime, changes, placeAt, resizeTo, unschedule, type DropContext, type Placement } from "./drop";
import { minutesAt, spanOf, staffAt, type Staff } from "./layout";

export type DragKind = "move" | "resize" | "place";

/** Where a drag would land right now. `staff` is an index into the staves. */
export type DropTarget =
  | { kind: "staff"; staff: number; placement: Placement }
  | { kind: "resize"; placement: Placement }
  | { kind: "tray"; placement: Placement }
  | { kind: "anytime"; placement: Placement };

export type DragPreview = { item: ShownItem; kind: DragKind; target: DropTarget | null };

type Gesture = {
  kind: DragKind;
  item: ShownItem;
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  touch: boolean;
  active: boolean;
  timer: number | null;
  /** Minutes between the pointer and the item's start, so a moved beam does not jump. */
  grab: number;
  dx: number;
  dy: number;
  target: DropTarget | null;
  /** The listeners this gesture added, so the same functions come off again. */
  listeners: {
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
    key: (e: KeyboardEvent) => void;
  };
};

export type DragSurfaces = {
  scroller: RefObject<HTMLDivElement | null>;
  layer: RefObject<HTMLDivElement | null>;
  tray: RefObject<HTMLElement | null>;
  anyTime: RefObject<HTMLElement | null>;
  fly: RefObject<HTMLDivElement | null>;
};

type Live = {
  ctx: DropContext;
  staves: Staff[];
  labelWidth: () => number;
  onDrop: (item: ShownItem, placement: Placement) => void;
  onTap: (item: ShownItem) => void;
};

const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
/** A touch has to rest this long before it picks an item up, so a swipe still scrolls the page. */
const LONG_PRESS_MS = 280;
const EDGE_PX = 40;
const EDGE_SPEED = 14;

const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

const targetKey = (t: DropTarget | null) => {
  if (!t) return "";
  const s = t.placement.schedule;
  const when = s.kind === "timed" ? `${s.start.getTime()}-${s.end.getTime()}` : s.kind;
  return `${t.kind}:${t.kind === "staff" ? t.staff : ""}:${when}`;
};

/** Pointer and touch dragging for the Score. The caller owns the preview so its layout can make room for the drop. */
export function useScoreDrag(surfaces: DragSurfaces, live: Live, setPreview: (preview: DragPreview | null) => void) {
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef(live);
  const frame = useRef<number | null>(null);

  useLayoutEffect(() => {
    latest.current = live;
  });

  function findTarget(g: Gesture): DropTarget | null {
    const { ctx, staves, labelWidth } = latest.current;
    const { scroller, layer, tray, anyTime: strip } = surfaces;
    if (g.kind === "resize") {
      const rect = layer.current?.getBoundingClientRect();
      if (!rect) return null;
      const placement = resizeTo(ctx, g.item, minutesAt(ctx.axis, g.x - rect.left));
      return placement ? { kind: "resize", placement } : null;
    }
    const scroll = scroller.current?.getBoundingClientRect();
    const rect = layer.current?.getBoundingClientRect();
    if (scroll && rect && inside(scroll, g.x, g.y) && g.x >= scroll.left + labelWidth()) {
      const staff = staffAt(staves, g.y - rect.top);
      if (staff >= 0) {
        const start = minutesAt(ctx.axis, g.x - rect.left) - g.grab;
        return { kind: "staff", staff, placement: placeAt(ctx, g.item, staves[staff].areaId, start) };
      }
    }
    const trayRect = tray.current?.getBoundingClientRect();
    if (trayRect && inside(trayRect, g.x, g.y) && g.item.schedule.kind !== "unscheduled") {
      return { kind: "tray", placement: unschedule() };
    }
    const stripRect = strip.current?.getBoundingClientRect();
    if (stripRect && inside(stripRect, g.x, g.y) && g.item.schedule.kind !== "day") {
      return { kind: "anytime", placement: anyTime(ctx) };
    }
    return null;
  }

  function track(g: Gesture) {
    const fly = surfaces.fly.current;
    if (fly) fly.style.transform = `translate(${g.x - g.dx}px, ${g.y - g.dy}px)`;
    const target = findTarget(g);
    if (targetKey(target) !== targetKey(g.target)) {
      g.target = target;
      setPreview({ item: g.item, kind: g.kind, target });
    }
  }

  function autoScroll() {
    frame.current = null;
    const g = gesture.current;
    const el = surfaces.scroller.current;
    if (!g?.active || !el) return;
    const r = el.getBoundingClientRect();
    if (g.y < r.top || g.y > r.bottom) return;
    const left = r.left + latest.current.labelWidth();
    const step = g.x < left + EDGE_PX ? -EDGE_SPEED : g.x > r.right - EDGE_PX ? EDGE_SPEED : 0;
    if (step === 0) return;
    const before = el.scrollLeft;
    el.scrollLeft += step;
    if (el.scrollLeft !== before) track(g);
    frame.current = requestAnimationFrame(autoScroll);
  }

  function activate(g: Gesture) {
    g.active = true;
    g.timer = null;
    document.documentElement.dataset.scoreDragging = "";
    setPreview({ item: g.item, kind: g.kind, target: null });
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
    if (!g.active) {
      if (g.kind !== "resize") latest.current.onTap(g.item);
      return;
    }
    if (g.target && changes(g.item, g.target.placement)) latest.current.onDrop(g.item, g.target.placement);
  }

  function onMove(e: PointerEvent) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    g.x = e.clientX;
    g.y = e.clientY;
    const moved = Math.hypot(g.x - g.x0, g.y - g.y0);
    if (!g.active) {
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

  function start(e: ReactPointerEvent<HTMLElement>, kind: DragKind, item: ShownItem) {
    if (e.button !== 0 || gesture.current) return;
    e.stopPropagation();
    const { ctx } = latest.current;
    const el = e.currentTarget.getBoundingClientRect();
    const layer = surfaces.layer.current?.getBoundingClientRect();
    const span = spanOf(item, ctx.date, ctx.timeZone);
    const touch = e.pointerType === "touch";
    const g: Gesture = {
      kind,
      item,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      touch,
      active: false,
      timer: null,
      grab: span && layer ? minutesAt(ctx.axis, e.clientX - layer.left) - span.start : 0,
      dx: kind === "place" ? e.clientX - el.left : 24,
      dy: kind === "place" ? e.clientY - el.top : 18,
      target: null,
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
