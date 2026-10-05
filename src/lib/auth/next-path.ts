const PROBE_ORIGIN = "http://next-path.invalid";

export const DEFAULT_NEXT_PATH = "/";

/**
 * Turns an untrusted `next` parameter into a same-origin path, or `/`.
 * Resolving against a fixed origin lets the URL parser apply the same
 * normalization a browser would (backslashes, stripped tabs and newlines),
 * so `//evil.com`, `/\evil.com` and `/\t/evil.com` all land off-origin and are rejected.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_NEXT_PATH;
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return DEFAULT_NEXT_PATH;
  }
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_NEXT_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}
