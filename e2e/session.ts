import { test as base, type BrowserContext, type Page } from "@playwright/test";

// The cookie src/lib/supabase/fake-session.ts reads. Its value is the per-run secret playwright.config.ts makes.
export const SESSION_COOKIE = "axiis-e2e-session";

export function sessionSecret(): string {
  const secret = process.env.E2E_FAKE_SESSION_SECRET;
  if (!secret) throw new Error("E2E_FAKE_SESSION_SECRET is unset; playwright.config.ts sets it for every run");
  return secret;
}

export const sessionHeader = () => ({ cookie: `${SESSION_COOKIE}=${sessionSecret()}` });

/**
 * A test whose browser context is signed in as the in-memory account, e2e@axiis.invalid. The tz cookie
 * already names the browser's zone, so the app's time-zone sync has nothing to send and never refreshes
 * the page under a test. A test that wants the sync to run sets a different cookie itself.
 */
export const signedIn = base.extend({
  context: async ({ context, baseURL, timezoneId }, provide) => {
    const zone = timezoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    await context.addCookies([
      { name: SESSION_COOKIE, value: sessionSecret(), url: baseURL },
      { name: "tz", value: encodeURIComponent(zone), url: baseURL },
    ]);
    await provide(context);
  },
});

/**
 * Waits until React has hydrated the page (src/components/shell/hydrated-mark.tsx), by which time the
 * palette's global key listener is attached. A server-drawn page is visible well before then, so a key
 * pressed or a line typed on sight can be lost. See docs/e2e-session.md, Waiting for the page.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

/**
 * Pins the app's "now" to a time of day today ("HH:MM", in the context's zone) on the signed-in routes, so a spec
 * that reads the now line or an hour label does not depend on when it runs. The server honours the cookie only in
 * the browser-test build with the fake session (getFakePinnedMinutes in src/lib/supabase/fake-session.ts), and
 * the page stops ticking to the real clock. Call it before the first navigation.
 */
export async function pinClock(context: BrowserContext, at: string, baseURL: string): Promise<void> {
  await context.addCookies([{ name: "axiis-e2e-at", value: at, url: baseURL }]);
}
