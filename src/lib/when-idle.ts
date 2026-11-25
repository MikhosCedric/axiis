/** The longest a call waits for an idle moment before it runs anyway. */
const IDLE_TIMEOUT_MS = 2000;

/**
 * Runs `run` once the browser is idle, for fetching a part of the page no first paint needs (the palette,
 * the detail sheet) before anyone asks for it. Returns a function that cancels it.
 */
export function whenIdle(run: () => void): () => void {
  if (typeof requestIdleCallback !== "function") {
    const timer = setTimeout(run, IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }
  const idle = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  return () => cancelIdleCallback(idle);
}
