"use client";

import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type Ref } from "react";
import { motionPlan, type Place } from "./motion-plan";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const EXIT = "cubic-bezier(0.4, 0, 1, 1)";

/** The key a row is known by across renders: the item it draws (`data-quick`, on it or inside it). */
function keyOf(el: Element): string | null {
  return (el as HTMLElement).dataset?.quick ?? el.querySelector<HTMLElement>("[data-quick]")?.dataset.quick ?? null;
}

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A list whose rows move instead of jumping (DESIGN.md, Moving rows): a row that changes place glides there,
 * a new row fades and settles in, and a row that leaves fades out where it stood while the rows below close
 * up. Positions are read once per render, after React has drawn it, and only transform and opacity are
 * animated, so nothing is laid out twice. The first render, and everything under reduced motion, is still.
 */
export function MotionList({ ref: outer, className = "", ...rest }: HTMLAttributes<HTMLUListElement> & { ref?: Ref<HTMLUListElement> }) {
  const list = useRef<HTMLUListElement | null>(null);
  // Where each row stood after the last render, and after the one before (a row React has just removed is
  // only in the older one by the time the removal is heard).
  const places = useRef<Map<string, Place> | null>(null);
  const older = useRef<Map<string, Place> | null>(null);

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const now = new Map<string, Place>();
    const rows = new Map<string, HTMLElement>();
    for (const child of el.children) {
      const key = keyOf(child);
      if (!key || (child as HTMLElement).dataset.ghost !== undefined) continue;
      const r = child.getBoundingClientRect();
      now.set(key, { top: r.top - box.top, left: r.left - box.left, width: r.width, height: r.height });
      rows.set(key, child as HTMLElement);
    }
    const was = places.current;
    older.current = was;
    places.current = now;
    if (!was || still()) return;
    const plan = motionPlan(was, now);
    for (const { key, dx, dy } of plan.moved) {
      rows.get(key)?.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 240, easing: EASE });
    }
    for (const key of plan.entered) {
      rows.get(key)?.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: EASE });
    }
  });

  // A row React takes away is drawn once more where it stood, fading, before the page paints.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const observer = new MutationObserver((changes) => {
      if (still()) return;
      for (const change of changes) {
        for (const node of change.removedNodes) {
          if (!(node instanceof HTMLElement) || node.dataset.ghost !== undefined) continue;
          const key = keyOf(node);
          const place = key ? (older.current?.get(key) ?? places.current?.get(key)) : undefined;
          if (!key || !place) continue;
          if (el.querySelector(`[data-quick="${CSS.escape(key)}"]`)) continue;
          const ghost = node.cloneNode(true) as HTMLElement;
          ghost.dataset.ghost = "";
          ghost.setAttribute("aria-hidden", "true");
          ghost.removeAttribute("data-quick");
          for (const inner of ghost.querySelectorAll("[data-quick]")) inner.removeAttribute("data-quick");
          Object.assign(ghost.style, {
            position: "absolute",
            top: `${place.top}px`,
            left: `${place.left}px`,
            width: `${place.width}px`,
            height: `${place.height}px`,
            margin: "0",
            pointerEvents: "none",
          });
          el.append(ghost);
          const done = () => ghost.remove();
          ghost.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.98)" }], { duration: 160, easing: EXIT }).finished.then(done, done);
        }
      }
    });
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    <ul
      ref={(node) => {
        list.current = node;
        if (typeof outer === "function") outer(node);
        else if (outer) outer.current = node;
      }}
      className={`relative ${className}`}
      {...rest}
    />
  );
}
