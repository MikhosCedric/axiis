import { NextResponse, type NextRequest } from "next/server";
import { namesNoDay } from "@/features/day/nav";
import { resolveAuthRedirect } from "@/lib/auth/redirect";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";
import { requestHasFakeSession } from "@/lib/supabase/fake-session";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  // Next reads the nonce from the request's CSP header and stamps its own scripts; the layout reads x-nonce for its inline one.
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce, { development: process.env.NODE_ENV === "development" });
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", policy);

  const { response, isAuthenticated } = await updateSession(request);
  const target = resolveAuthRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: isAuthenticated || requestHasFakeSession(request),
  });
  if (target === null && namesNoDay(request.nextUrl.pathname)) {
    // No route answers this path, so Next renders not-found.tsx with a 404 before anything streams.
    const missing = NextResponse.rewrite(new URL("/_no-such-day", request.url), { request });
    for (const cookie of response.cookies.getAll()) missing.cookies.set(cookie);
    missing.headers.set("Content-Security-Policy", policy);
    return missing;
  }
  if (target === null) {
    response.headers.set("Content-Security-Policy", policy);
    return response;
  }

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Content-Security-Policy", policy);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
