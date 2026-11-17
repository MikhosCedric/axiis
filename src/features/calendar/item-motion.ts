"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Motion for the calendar's items (DESIGN.md, Motion): what changed place travels there, what arrived grows in at
 * its slot, what left fades where it stood, and stepping the day or week slides the columns the way you went.
 * Only items whose place or presence changed are touched, positions are read once per render, and only transform
 * and opacity move. Everything is a Web Animation on the item, so input keeps working while it plays and a new
 * render cancels it. Under reduced motion nothing travels: arrivals fade in 100ms and that is all.
 */

const ITEMS = '[data-calendar-grid] [data-item], [data-drop="tray"] [data-item]';
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const EXIT = "cubic-bezier(0.4, 0, 1, 1)";
/** More changes than this at once is a different view or a filter, not an action: it is not animated. */
const MOST = 24;
/** A page change remounts the grid; a step made inside this long ago still counts as the same view. */
const KEEP_MS = 4000;

type Rec = { x: number; y: number; w: number; h: number; grid: boolean; chip: boolean; el: HTMLElement };
type Memory = { mode: string; first: string; at: number; recs: Map<string, Rec> };

/** Survives the grid being remounted by a step to another day, so the step can be told. */
let memory: Memory | null = null;

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function whereOf(el: HTMLElement): string {
  const col = el.closest<HTMLElement>("[data-day-col]")?.dataset.dayCol;
  if (col) return col;
  return el.closest<HTMLElement>("[data-anytime]")?.dataset.anytime ?? "tray";
}

function measure(root: HTMLElement): Map<string, Rec> {
  const recs = new Map<string, Rec>();
  const sx = window.scrollX;
  const sy = window.scrollY;
  for (const el of document.querySelectorAll<HTMLElement>(ITEMS)) {
    const id = el.dataset.item;
    if (!id) continue;
    const key = `${id}|${whereOf(el)}`;
    if (recs.has(key)) continue;
    const grid = root.contains(el);
    const r = el.getBoundingClientRect();
    recs.set(key, {
      x: r.left + sx + (grid ? root.scrollLeft : 0),
      y: r.top + sy + (grid ? root.scrollTop : 0),
      w: r.width,
      h: r.height,
      grid,
      chip: el.tagName === "LI",
      el,
    });
  }
  return recs;
}

/** Where a record stood, in the window now (the page or the grid may have scrolled since). */
function viewport(rec: Rec, root: HTMLElement) {
  return { x: rec.x - window.scrollX - (rec.grid ? root.scrollLeft : 0), y: rec.y - window.scrollY - (rec.grid ? root.scrollTop : 0) };
}

/** A look-alike of an item that is no longer (or not yet) where it was, laid over the page for a moment. Takes no pointer and no focus. */
function stand(from: Rec, root: HTMLElement): HTMLElement {
  const copy = from.el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-item");
  copy.removeAttribute("data-state");
  for (const n of copy.querySelectorAll<HTMLElement>("[data-nav], [data-id], [id]")) {
    n.removeAttribute("data-nav");
    n.removeAttribute("data-id");
    n.removeAttribute("id");
  }
  for (const b of copy.querySelectorAll<HTMLElement>("button")) {
    b.tabIndex = -1;
    b.style.pointerEvents = "none";
  }
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  const at = viewport(from, root);
  Object.assign(copy.style, {
    position: "fixed",
    inset: "auto",
    left: `${at.x}px`,
    top: `${at.y}px`,
    width: `${from.w}px`,
    height: `${from.h}px`,
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
    transformOrigin: "0 0",
  });
  document.body.append(copy);
  return copy;
}

export function useItemMotion({ scroller, days, mode, busy }: { scroller: RefObject<HTMLElement | null>; days: readonly string[]; mode: string; busy: boolean }) {
  const before = useRef<Map<string, Rec> | null>(null);
  const first = useRef<string | null>(null);
  const count = useRef(days.length);
  const playing = useRef<Set<Animation>>(new Set());
  const last = useRef<{ mode: string; first: string; recs: Map<string, Rec> } | null>(null);

  useLayoutEffect(() => {
    const root = scroller.current;
    // A drag in progress redraws on every move; the moment it lands is compared with the moment it began.
    if (!root || busy) return;
    // What this hook started is cancelled first, so every position read is where the page really laid it.
    for (const a of playing.current) a.cancel();
    playing.current.clear();

    // The page waking to a different width redraws the span (a phone's seven days become three): a layout, not an action.
    const mine = days[0] ?? "";
    if (before.current && count.current !== days.length) before.current = null;
    count.current = days.length;
    if (first.current === null && before.current === null && memory && memory.mode === mode && Date.now() - memory.at < KEEP_MS) {
      before.current = memory.recs;
      first.current = memory.first;
    }
    const prev = before.current;
    const prevFirst = first.current;
    const now = measure(root);
    before.current = now;
    first.current = mine;
    last.current = { mode, first: mine, recs: now };
    if (!prev || prevFirst === null || document.hidden) return;

    const calm = still();
    const run = (el: Element, frames: Keyframe[], duration: number, easing: string, options: KeyframeAnimationOptions = {}) => {
      const a = el.animate(frames, { duration, easing, fill: "backwards", ...options });
      playing.current.add(a);
      a.addEventListener("finish", () => playing.current.delete(a));
      a.addEventListener("cancel", () => playing.current.delete(a));
      return a;
    };

    // Stepping to another day or week: the columns slide the way you went, the headers stay.
    if (prevFirst !== mine) {
      if (calm) return;
      const dir = mine > prevFirst ? 1 : -1;
      for (const col of root.querySelectorAll("[data-day-col], [data-anytime]")) {
        run(col, [{ transform: `translateX(${dir * 28}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], 280, EASE);
      }
      return;
    }

    // Pair what is gone with what is new by the item, so a block that changed day or form travels instead of vanishing.
    const gone = [...prev].filter(([k]) => !now.has(k));
    const fresh = [...now].filter(([k]) => !prev.has(k));
    const moved: Array<[string, Rec, Rec]> = [];
    for (const [k, to] of now) {
      const from = prev.get(k);
      if (!from) continue;
      const a = viewport(from, root);
      const b = viewport(to, root);
      if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.y - b.y) > 1.5) moved.push([k, from, to]);
    }
    const idOf = (k: string) => k.slice(0, k.lastIndexOf("|"));
    const pairs: Array<[Rec, Rec]> = [];
    const lone = { gone: [] as Rec[], fresh: [] as Rec[] };
    const goneBy = Map.groupBy(gone, ([k]) => idOf(k));
    const freshBy = Map.groupBy(fresh, ([k]) => idOf(k));
    for (const [id, g] of goneBy) {
      const f = freshBy.get(id);
      if (f && f.length === 1 && g.length === 1) {
        pairs.push([g[0][1], f[0][1]]);
        freshBy.delete(id);
      } else lone.gone.push(...g.map(([, r]) => r));
    }
    for (const f of freshBy.values()) lone.fresh.push(...f.map(([, r]) => r));

    if (moved.length + pairs.length + lone.gone.length + lone.fresh.length > MOST) return;

    for (const [, from, to] of moved) {
      if (calm) break;
      const a = viewport(from, root);
      const b = viewport(to, root);
      run(to.el, [{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)`, transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }], 240, EASE);
    }

    for (const [from, to] of pairs) {
      if (calm) {
        run(to.el, [{ opacity: 0 }, { opacity: 1 }], 100, "linear");
        continue;
      }
      // Planned from the Inbox, or sent back to it: a look-alike travels over the page and the real one takes over as it lands.
      const a = viewport(from, root);
      const b = viewport(to, root);
      const copy = stand(from, root);
      const land = run(
        copy,
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${to.w / from.w}, ${to.h / from.h})`, opacity: 1, offset: 0.85 },
          { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${to.w / from.w}, ${to.h / from.h})`, opacity: 0 },
        ],
        320,
        EASE,
        { fill: "forwards" },
      );
      run(to.el, [{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], 320, "linear");
      land.addEventListener("finish", () => copy.remove());
      land.addEventListener("cancel", () => copy.remove());
    }

    for (const to of lone.fresh) {
      if (calm) run(to.el, [{ opacity: 0 }, { opacity: 1 }], 100, "linear");
      else run(to.el, [{ opacity: 0, transform: "scale(0.96)", transformOrigin: "50% 0" }, { opacity: 1, transform: "none", transformOrigin: "50% 0" }], 200, EASE);
    }

    for (const from of lone.gone) {
      if (calm) continue;
      const copy = stand(from, root);
      const out = copy.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.98)" }], { duration: 140, easing: EXIT, fill: "forwards" });
      out.addEventListener("finish", () => copy.remove());
      out.addEventListener("cancel", () => copy.remove());
    }
  });

  // Hand the last picture to the grid that replaces this one when a step remounts it.
  useLayoutEffect(
    () => () => {
      const l = last.current;
      if (l) memory = { mode: l.mode, first: l.first, at: Date.now(), recs: l.recs };
    },
    [],
  );
}
