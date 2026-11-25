"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useTransition } from "react";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { whenIdle } from "@/lib/when-idle";
import { preloadDetailSheet } from "./detail-sheet-lazy";
import { selectionStep, withItem } from "./selection";

// The history entry this tab added when it last opened the panel. One per tab, shared by every screen.
let opened: string | null = null;

/**
 * The item the detail panel shows, by `?item=`, and how to change it. `selectedId`
 * moves at once while the next page loads; `selectedParam` is what the address says.
 */
export function useItemSelection(): {
  selectedParam: string | null;
  selectedId: string | null;
  select: (id: string | null) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedParam = params.get(SELECTED_ITEM_PARAM);
  const [selectedId, setSelectedId] = useOptimistic(selectedParam);
  const [, startTransition] = useTransition();
  // The sheet is split from the page; a screen that can open it fetches it once idle.
  useEffect(() => whenIdle(preloadDetailSheet), []);

  function select(id: string | null) {
    const search = params.toString();
    const here = withItem(pathname, search, SELECTED_ITEM_PARAM, selectedParam);
    const to = withItem(pathname, search, SELECTED_ITEM_PARAM, id);
    const step = selectionStep({ from: selectedParam, to: id, here, opened });
    if (step === "none") return;
    if (id !== null) preloadDetailSheet();
    startTransition(() => {
      setSelectedId(id);
      if (step === "back") {
        opened = null;
        router.back();
        return;
      }
      if (step === "push") opened = to;
      else if (opened === here) opened = to;
      (step === "push" ? router.push : router.replace)(to, { scroll: false });
    });
  }

  return { selectedParam, selectedId, select };
}
