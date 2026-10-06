const ALLOWED = new Set(["http:", "https:", "mailto:"]);
const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#:]|$)/i;

/**
 * The link a user typed, as a safe href, or null. Only http, https and mailto
 * survive; a bare domain such as `example.com/x` becomes https.
 */
export function safeHref(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const candidate = BARE_DOMAIN.test(text) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? `https://${text}` : text;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!ALLOWED.has(url.protocol)) return null;
  if (url.protocol !== "mailto:" && !url.hostname) return null;
  return url.href;
}
