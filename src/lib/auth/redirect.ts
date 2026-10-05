export const LOGIN_PATH = "/login";

/** Paths that must stay reachable without a session. Static assets and Next internals are excluded by the proxy matcher instead. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
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
  if (pathname === "/") return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
}
