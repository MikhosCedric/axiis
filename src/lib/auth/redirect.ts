export const LOGIN_PATH = "/login";

/** Exact paths a stranger or a crawler may reach without a session. */
const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  "/",
  LOGIN_PATH,
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/icon.svg",
]);

/** Paths that must stay reachable without a session. Static assets and Next internals are excluded by the proxy matcher instead. */
function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    // Dev harness pages render fixtures only, and never exist in a production build.
    (process.env.NODE_ENV !== "production" && (pathname === "/dev" || pathname.startsWith("/dev/")))
  );
}

/** Returns the path to redirect to, or `null` to let the request through. */
export function resolveAuthRedirect({
  pathname,
  isAuthenticated,
}: {
  pathname: string;
  isAuthenticated: boolean;
}): string | null {
  if (isAuthenticated) return pathname === LOGIN_PATH ? "/" : null;
  if (isPublicPath(pathname)) return null;
  return `${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
}
