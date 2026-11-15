"use client";

import { useSyncExternalStore } from "react";

/** Below the width where the side panel gives way to the phone's bar (`--breakpoint-rail`). */
const NARROW = "(max-width: 759.98px)";

function subscribe(changed: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}

/**
 * True on a screen as narrow as a phone. The server cannot know, so it draws the wide form and the
 * browser corrects it as the page wakes; a page reached by a link inside the app is right from the start.
 */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
