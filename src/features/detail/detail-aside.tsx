"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
 */
export function DetailAside({ pending, children }: { pending: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

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
      className="scroll-mt-2 border-t border-rule bg-sheet outline-none min-[1180px]:min-h-dvh min-[1180px]:border-t-0 min-[1180px]:border-l"
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
