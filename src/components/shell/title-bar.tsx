"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A page's large title folding into a bar, as Apple's large titles do: while the page's own heading is on
 * screen nothing shows; once it scrolls under the top, a glass bar with the title in a smaller size stays
 * at the top of the page column (under the phone's header). The bar repeats words the heading already
 * says, so it is hidden from assistive tech and takes no focus. It takes no room either: it lies over the
 * page's top padding until it shows.
 */
export function TitleBar({ heading, children }: { heading: string; children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    const el = bar.current;
    const title = document.getElementById(heading);
    if (!el || !title) return;
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      observer?.disconnect();
      // The heading counts as gone once it is under the bar, wherever the bar sticks (below a phone's header).
      const under = parseFloat(getComputedStyle(el).top) + el.offsetHeight;
      observer = new IntersectionObserver(([entry]) => setFolded(!entry.isIntersecting), {
        rootMargin: `-${Math.round(under)}px 0px 0px 0px`,
      });
      observer.observe(title);
    };
    watch();
    window.addEventListener("resize", watch);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", watch);
    };
  }, [heading]);

  return (
    <div
      ref={bar}
      aria-hidden="true"
      data-folded={folded || undefined}
      className={`title-bar sticky top-14 z-20 -mx-4 -mt-6 mb-[calc(24px-3rem)] flex h-12 items-center px-4 rail:top-0 rail:-mx-9 rail:-mt-8 rail:mb-[calc(32px-3rem)] rail:px-9 ${
        folded ? "glass border-rule-soft" : "border-transparent"
      }`}
    >
      <span className="title-bar-text truncate font-serif text-[17px] leading-none font-medium">{children}</span>
    </div>
  );
}
