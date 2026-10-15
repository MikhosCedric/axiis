"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";

/**
 * A page arriving from the nav rises 6px into place while the one it replaces fades, so a change of
 * place reads as turning a page rather than a cut. Keyed by path only: a change of query (the selected
 * item, Score or List) is the same page and keeps its own transitions (the Score and List morph).
 * Navigations are transitions, which is what lets React run these; reduced motion drops them in globals.css.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
