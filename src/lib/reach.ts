/** What a save says when the browser could not deliver it: offline, or no answer from the server. */
export const UNREACHABLE = "Could not reach Axiis. Check your connection and try again.";

/**
 * A server action's answer, or a refusal when the call itself failed. A rejected action inside a
 * transition goes to the error boundary and replaces the whole page, so every save from a client
 * component awaits its action through this.
 */
export async function reach<T>(call: Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await call;
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

/**
 * Loads a part of the page that is split into its own file. A failed load rejects, and a rejected lazy part replaces
 * the whole page with the error page. Offline that is no fault: the part is waited for until the connection is back,
 * then tried again. Online, a failure is real and still throws.
 */
export function loadWhenReachable<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((error: unknown) => {
    if (navigator.onLine) throw error;
    return new Promise<T>((resolve, reject) => {
      window.addEventListener("online", () => loadWhenReachable(load).then(resolve, reject), { once: true });
    });
  });
}
