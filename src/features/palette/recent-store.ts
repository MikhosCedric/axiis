import { parseVisits, RECENT_KEY, type Visit } from "./recent";

// Browser only. The palette's Recent list lives in this browser's storage, so a change made on the server
// (a tag renamed or deleted) has to be told to it here; nothing else would ever correct it.

export function readVisits(): Visit[] {
  try {
    return parseVisits(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

/** Rewrites the stored visits. Storage that is off or full leaves them as they were. */
export function changeVisits(change: (list: Visit[]) => Visit[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(change(readVisits())));
  } catch {
    // Nothing to correct when nothing could be stored.
  }
}

/**
 * Asks the service worker to drop its offline copy of a page that no longer exists, so it is not offered
 * offline either. The worker compares paths decoded and in any case, as tag names are matched.
 */
export function forgetSavedPage(path: string): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "forget", path });
  } catch {
    // No worker, nothing saved.
  }
}
