import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthRedirect } from "@/lib/auth/redirect";
import { requestHasFakeSession } from "@/lib/supabase/fake-session";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const target = resolveAuthRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: isAuthenticated || requestHasFakeSession(request),
  });
  if (target === null) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
