import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { FakeAccount } from "./fake-account";

// Every body below sits inside a literal `process.env.AXIIS_E2E_BUILD === "1"` test. next.config.ts inlines
// AXIIS_E2E_BUILD at build time, as "1" only in the browser-test build and "" everywhere else, so a normal
// build drops the branch, the cookie name and the fake account. `npm run check:no-fake-session` proves it
// on the built output. See docs/e2e-session.md.

/**
 * The only decision of whether a request carries the browser-test session. True only in the browser-test
 * build, with `E2E_FAKE_SESSION=1`, outside Vercel, and with a cookie equal to `E2E_FAKE_SESSION_SECRET`.
 */
export function isFakeSession(cookieValue: string | undefined): boolean {
  if (process.env.AXIIS_E2E_BUILD === "1") {
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
  if (process.env.AXIIS_E2E_BUILD === "1") return isFakeSession(request.cookies.get("axiis-e2e-session")?.value);
  return false;
}

/**
 * Server only. The in-memory account when this request carries the browser-test session, else null.
 * An `axiis-e2e-account` cookie picks another account: `empty` starts with no items, for first-day tests;
 * `areas` holds a few items in areas, for the area colour tests.
 */
export async function getFakeAccount(): Promise<FakeAccount | null> {
  if (process.env.AXIIS_E2E_BUILD === "1") {
    const jar = await cookies();
    if (!isFakeSession(jar.get("axiis-e2e-session")?.value)) return null;
    const kind = jar.get("axiis-e2e-account")?.value;
    return (await import("./fake-account")).fakeAccount(kind === "empty" || kind === "areas" ? kind : "fixtures");
  }
  return null;
}

/** Server only. Clears the browser-test session cookie, as signing out clears Supabase's. */
export async function endFakeSession(): Promise<void> {
  if (process.env.AXIIS_E2E_BUILD === "1") (await cookies()).delete("axiis-e2e-session");
}
