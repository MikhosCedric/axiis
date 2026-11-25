"use client";

import dynamic from "next/dynamic";

/**
 * The detail sheet in its own file, so a page with nothing selected does not load it to draw. A page opened
 * with an item still draws the sheet on the server and preloads its file. Elsewhere `useItemSelection` fetches
 * it once the page is idle, and again as an item is chosen, so the file arrives alongside the item, not after
 * it. The imports are written out in each call, which is how Next finds the file to preload.
 */
export const DetailSheet = dynamic(() => import("./detail-sheet").then((m) => m.DetailSheet));
export const MissingItem = dynamic(() => import("./detail-sheet").then((m) => m.MissingItem));

let fetched = false;
/** Starts fetching the sheet's file, once per page load; a failed fetch is tried again on the next call. */
export function preloadDetailSheet() {
  if (fetched) return;
  fetched = true;
  import("./detail-sheet").catch(() => {
    fetched = false;
  });
}
