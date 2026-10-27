import { rowEntries, type Quick, type RowEntry } from "./context";
import { SWIPE, swipeAxis, swipeEnd, swipeReach } from "./gesture-model";

type Track = {
  row: HTMLElement;
  entry: RowEntry;
  x: number;
  y: number;
  id: number;
  axis: "x" | "y" | null;
  dx: number;
  timer: number;
};

const STRIP =
  "absolute inset-y-0 z-[6] flex items-center overflow-hidden text-[13px] font-medium whitespace-nowrap motion-safe:transition-[width] motion-safe:duration-(--dur-spring) motion-safe:ease-(--ease-spring)";

/**
 * Swipes and long presses on the rows of the lists (rows marked `data-swipe`: Today's List, the Inbox, Due,
 * Lists), on a touch screen only. Right ticks a row; left leaves Plan and Delete showing at its end; a long
 * press opens its menu. The row does not move: a strip grows from the edge the finger left, so nothing under
 * it jumps, and a scroll that starts on a row is still a scroll (rows take `touch-action: pan-y`). The Score
 * is never marked, since its axis scrolls sideways. Returns a function that takes the listeners off.
 */
export function attachGestures(api: { current: Quick | null }): () => void {
  // Set by the provider once it has drawn, before any finger reaches a row.
  const quick = () => api.current!;
  let track: Track | null = null;
  let strip: HTMLElement | null = null;
  let shown: { row: HTMLElement; strip: HTMLElement } | null = null;
  let swallowClick = false;

  function clearStrip(el: HTMLElement | null) {
    el?.remove();
  }

  function closeShown() {
    clearStrip(shown?.strip ?? null);
    shown = null;
  }

  function makeStrip(row: HTMLElement, entry: RowEntry, side: "done" | "actions"): HTMLElement {
    const el = document.createElement("div");
    el.dataset.swipeStrip = side;
    el.setAttribute("aria-hidden", "true");
    el.className = `${STRIP} ${side === "done" ? "left-0 justify-start bg-ink pl-4 text-paper" : "right-0 justify-end bg-press text-ink"}`;
    el.style.width = "0px";
    if (side === "done") el.textContent = entry.item.done ? "Open again" : "Done";
    row.append(el);
    return el;
  }

  function addActions(el: HTMLElement, entry: RowEntry, row: HTMLElement) {
    el.removeAttribute("aria-hidden");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", `Actions for ${entry.item.title}`);
    const button = (label: string, action: "plan" | "delete", tone: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("aria-label", `${label} ${entry.item.title}`);
      b.className = `h-full min-w-[76px] px-3 ${tone}`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        closeShown();
        quick().run(action, entry.item, entry.hooks, row);
      });
      return b;
    };
    el.replaceChildren(button("Plan", "plan", "text-ink"), button("Delete", "delete", "bg-ink text-paper"));
    el.querySelector("button")?.focus({ preventScroll: true });
  }

  function onDown(e: PointerEvent) {
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    const target = e.target as HTMLElement;
    if (shown && !shown.strip.contains(target)) {
      closeShown();
      swallowClick = true;
      return;
    }
    const row = target.closest<HTMLElement>("[data-swipe]");
    const entry = row && rowEntries.get(row);
    if (!row || !entry || target.closest("input, textarea, [data-quick-cluster], [data-swipe-strip]")) return;
    const at = { x: e.clientX, y: e.clientY };
    track = {
      row,
      entry,
      ...at,
      id: e.pointerId,
      axis: null,
      dx: 0,
      timer: window.setTimeout(() => {
        // A still finger: the row's menu, where it pressed. Android sends its own contextmenu for this, which
        // the row already answers, so this only acts when no menu opened.
        if (!track || track.axis !== null || quick().openFor(entry.item.key)) return;
        swallowClick = true;
        quick().open("context", entry.item, entry.hooks, { left: at.x, top: at.y, width: 0, height: 0 }, row);
        track = null;
      }, SWIPE.longPress),
    };
  }

  function onMove(e: PointerEvent) {
    if (!track || e.pointerId !== track.id) return;
    const dx = e.clientX - track.x;
    const dy = e.clientY - track.y;
    if (Math.hypot(dx, dy) > SWIPE.slop) window.clearTimeout(track.timer);
    track.axis ??= swipeAxis(dx, dy);
    if (track.axis === "y") {
      track = null;
      return;
    }
    if (track.axis !== "x") return;
    const side = dx >= 0 ? "done" : "actions";
    if (strip?.dataset.swipeStrip !== side) {
      clearStrip(strip);
      strip = makeStrip(track.row, track.entry, side);
    }
    strip.style.transition = "none";
    strip.style.width = `${swipeReach(dx)}px`;
    track.dx = dx;
  }

  function onUp(e: PointerEvent) {
    if (!track || e.pointerId !== track.id) return;
    window.clearTimeout(track.timer);
    const { row, entry, axis, dx } = track;
    track = null;
    if (axis !== "x" || !strip) return;
    swallowClick = true;
    const el = strip;
    strip = null;
    el.style.transition = "";
    const end = e.type === "pointercancel" ? "close" : swipeEnd(dx);
    if (end === "open") {
      el.style.width = `${SWIPE.open}px`;
      addActions(el, entry, row);
      shown = { row, strip: el };
      return;
    }
    el.style.width = "0px";
    const gone = () => clearStrip(el);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) gone();
    else el.addEventListener("transitionend", gone, { once: true });
    window.setTimeout(gone, 500);
    if (end === "done") quick().run("done", entry.item, entry.hooks, row);
  }

  function onClick(e: MouseEvent) {
    if (!swallowClick) return;
    swallowClick = false;
    if ((e.target as HTMLElement).closest("[data-swipe-strip]")) return;
    e.preventDefault();
    e.stopPropagation();
  }

  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointermove", onMove, true);
  document.addEventListener("pointerup", onUp, true);
  document.addEventListener("pointercancel", onUp, true);
  document.addEventListener("click", onClick, true);
  return () => {
    closeShown();
    clearStrip(strip);
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("pointerup", onUp, true);
    document.removeEventListener("pointercancel", onUp, true);
    document.removeEventListener("click", onClick, true);
  };
}
