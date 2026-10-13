import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { FakeAccount } from "./fake-account";

// Every body below sits inside a literal `process.env.NODE_ENV === "development"` test. Next inlines
// NODE_ENV at build time, so a production build drops the branch, the cookie name and the fake account.
// `npm run check:no-fake-session` proves it on the built output. See docs/e2e-session.md.

/**
 * The only decision of whether a request carries the browser-test session. True only in `next dev`,
 * with `E2E_FAKE_SESSION=1`, outside Vercel, and with a cookie equal to `E2E_FAKE_SESSION_SECRET`.
 */
export function isFakeSession(cookieValue: string | undefined): boolean {
  if (process.env.NODE_ENV === "development") {
    const secret = process.env.E2E_FAKE_SESSION_SECRET ?? "";
    if (process.env.E2E_FAKE_SESSION !== "1" || process.env.VERCEL !== undefined) return false;
    if (secret.length < 32 || cookieValue === undefined) return false;
    const given = Buffer.from(cookieValue);
    const expected = Buffer.from(secret);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
  return false;
}

/** For the proxy, which reads cookies off the request. */
export function requestHasFakeSession(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return isFakeSession(request.cookies.get("axiis-e2e-session")?.value);
  return false;
}

/**
 * Server only. The in-memory account when this request carries the browser-test session, else null.
 * An `axiis-e2e-account=empty` cookie picks a second account that starts with no items, for first-day tests.
 */
export async function getFakeAccount(): Promise<FakeAccount | null> {
  if (process.env.NODE_ENV === "development") {
    const jar = await cookies();
    if (!isFakeSession(jar.get("axiis-e2e-session")?.value)) return null;
    return (await import("./fake-account")).fakeAccount(jar.get("axiis-e2e-account")?.value === "empty" ? "empty" : "fixtures");
  }
  return null;
}

/** Server only. Clears the browser-test session cookie, as signing out clears Supabase's. */
export async function endFakeSession(): Promise<void> {
  if (process.env.NODE_ENV === "development") (await cookies()).delete("axiis-e2e-session");
}
