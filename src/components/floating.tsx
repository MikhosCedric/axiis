"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { placeNear, rovingStep, type Box } from "@/lib/placement";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), a[href], [tabindex='0']";

/**
 * A floating layer over the page (a popover or a menu), as DESIGN.md's
 * Interaction tokens draw it: a native `popover`, placed beside `at` and held
 * inside the window, with the browser's light dismiss (Escape and a click
 * outside close it). It closes too when Tab goes past its last control (or
 * Shift Tab before its first), or the page scrolls or resizes under it. The control marked `data-autofocus`, else the
 * first, takes focus as it opens. Arrow keys move between the buttons of a
 * `data-roving` group.
 *
 * `onClosed(refocus)` says whether focus should go back to what opened it:
 * true after Escape or a choice, false when a click outside put focus on
 * something else, which keeps it.
 */
export function Floating({
  at,
  label,
  role = "dialog",
  className = "",
  onClosed,
  children,
}: {
  at: Box;
  label: string;
  role?: "dialog" | "menu";
  className?: string;
  onClosed: (refocus: boolean) => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const closed = useRef(onClosed);
  useEffect(() => {
    closed.current = onClosed;
  });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.showPopover();
    const { width, height } = el.getBoundingClientRect();
    const { left, top } = placeNear(at, { width, height }, { width: window.innerWidth, height: window.innerHeight });
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const away = () => el.hidePopover();
    // A native listener: the toggle event of a popover that is not a `details` is not one React dispatches everywhere.
    const toggled = (e: Event) => {
      if ((e as ToggleEvent).newState !== "closed") return;
      const now = document.activeElement;
      closed.current(!now || now === document.body || el.contains(now));
    };
    el.addEventListener("toggle", toggled);
    // The page moving under it would leave it pointing at nothing, so it closes, as a native menu does.
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      el.removeEventListener("toggle", toggled);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
      if (el.matches(":popover-open")) el.hidePopover();
    };
  }, [at]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Escape belongs to this layer: the browser closes it, and nothing behind it should also act.
    if (e.key === "Escape") {
      e.stopPropagation();
      return;
    }
    const target = e.target as HTMLElement;
    if (e.key === "Tab") {
      // Tab past the last control, or Shift Tab before the first, closes it and goes back to what opened it,
      // rather than on to whatever follows the layer at the end of the page.
      const all = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (target === (e.shiftKey ? all[0] : all[all.length - 1])) {
        e.preventDefault();
        e.currentTarget.hidePopover();
      }
      return;
    }
    const group = target.closest<HTMLElement>("[data-roving]");
    if (!group || target.tagName !== "BUTTON" || e.altKey || e.ctrlKey || e.metaKey) return;
    const buttons = [...group.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const to = rovingStep(e.key, buttons.indexOf(target as HTMLButtonElement), buttons.length);
    if (to === null) return;
    e.preventDefault();
    buttons[to].focus();
  }

  return (
    <div
      ref={box}
      popover="auto"
      role={role}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`pointer-events-auto fixed inset-auto m-0 rounded-lg border border-rule bg-sheet text-ink shadow-float [--ground:var(--sheet)] motion-safe:animate-pop-in ${className}`}
    >
      {children}
    </div>
  );
}
