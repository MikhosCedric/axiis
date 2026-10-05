"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";

/** Builds a link to this page with a different item selected, or none, keeping every other query param. */
export function useItemHref(): (id: string | null) => string {
  const pathname = usePathname();
  const params = useSearchParams();
  return (id) => {
    const next = new URLSearchParams(params.toString());
    if (id === null) next.delete(SELECTED_ITEM_PARAM);
    else next.set(SELECTED_ITEM_PARAM, id);
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
}
