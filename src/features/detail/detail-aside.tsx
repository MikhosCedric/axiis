"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { isTypingTarget } from "@/features/day/nav";
import { useItemSelection } from "./use-item-selection";

/** Below this width the panel stacks under the screen instead of sitting beside it. */
const STACKED = "(max-width: 1179px)";

/**
 * The column the detail panel sits in. While another item is on its way in,
 * the one still showing is inert, so a click meant for the next item can never
 * land on it.
 *
 * Stacked under the screen, a newly opened item would land out of view, so it
 * is scrolled up and focus moves to it. Closing puts focus back on whatever
 * opened it.
 *
 * Escape closes it from anywhere on the page, unless something closer used
 * the key first: a text field, an open dialog or popover, a drag, or a row
 * that closes the panel itself.
 */
export function DetailAside({ pending, children }: { pending: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { select } = useItemSelection();
  const close = useRef(select);

  useEffect(() => {
    close.current = select;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      if (isTypingTarget(e.target as HTMLElement | null)) return;
      if (document.querySelector("dialog[open], :popover-open")) return;
      e.preventDefault();
      close.current(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const aside = ref.current;
    if (pending || !aside) return;
    const active = document.activeElement;
    if (aside.contains(active)) return;
    if (active instanceof HTMLElement && active !== document.body) opener.current = active;
    if (!window.matchMedia(STACKED).matches) return;
    aside.focus({ preventScroll: true });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    aside.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  }, [pending]);

  useEffect(
    () => () => {
      // Focus was inside the panel as it went, so it fell to the body; anywhere else, the person put it there.
      const to = opener.current;
      const active = document.activeElement;
      if (to?.isConnected && (active === null || active === document.body)) to.focus();
    },
    [],
  );

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Details"
      aria-busy={pending}
      className="scroll-mt-2 border-t border-rule bg-sheet outline-none motion-safe:animate-panel-rise min-[1180px]:min-h-dvh min-[1180px]:border-t-0 min-[1180px]:border-l min-[1180px]:motion-safe:animate-panel-in"
    >
      <div className="px-4 py-6 rail:px-9 min-[1180px]:sticky min-[1180px]:top-0 min-[1180px]:max-h-dvh min-[1180px]:overflow-y-auto min-[1180px]:px-6 min-[1180px]:py-8">
        {/* The fade waits a beat, so a quick switch does not flicker. */}
        <div inert={pending} className={pending ? "opacity-40 transition-opacity delay-150 duration-200" : undefined}>
          {children}
        </div>
      </div>
    </aside>
  );
}
