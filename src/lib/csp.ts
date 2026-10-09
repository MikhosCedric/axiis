/**
 * The Content-Security-Policy for one request. Scripts run only with this request's nonce (and
 * what those scripts load, `strict-dynamic`), which is what stops an injected script from running.
 *
 * Inline styles stay allowed because the Score and Week place items with `style` attributes.
 * `form-action` is left out on purpose: a browser checks it again on the redirect to Google
 * after "Continue with Google", and that redirect leaves the origin.
 */
export function contentSecurityPolicy(nonce: string, { development }: { development: boolean }): string {
  const directives = [
    "default-src 'self'",
    // React reads server stack traces with eval in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // The browser talks only to this origin: Supabase is reached from the server. Dev adds the reload socket.
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/** A fresh, unguessable nonce: 128 random bits as base64. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}
