"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AREA_PARAM, TAG_PARAM, withFilter } from "./href";

/**
 * Keeps the address's filter on a link to another view, so moving a day, a week or
 * a month, or switching between them, stays inside the same area or tag. The
 * values pass through as they are; the page that receives them checks them.
 */
export function useKeepFilter(): (href: string) => string {
  const params = useSearchParams();
  const area = params.get(AREA_PARAM) ?? undefined;
  const tag = params.get(TAG_PARAM) ?? undefined;
  return useCallback((href: string) => (area || tag ? withFilter(href, { area, tag }) : href), [area, tag]);
}
