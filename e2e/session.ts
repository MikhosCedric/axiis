import { test as base } from "@playwright/test";

// The cookie src/lib/supabase/fake-session.ts reads. Its value is the per-run secret playwright.config.ts makes.
export const SESSION_COOKIE = "axiis-e2e-session";

export function sessionSecret(): string {
  const secret = process.env.E2E_FAKE_SESSION_SECRET;
  if (!secret) throw new Error("E2E_FAKE_SESSION_SECRET is unset; playwright.config.ts sets it for every run");
  return secret;
}

export const sessionHeader = () => ({ cookie: `${SESSION_COOKIE}=${sessionSecret()}` });

/** A test whose browser context is signed in as the in-memory account, e2e@axiis.invalid. */
export const signedIn = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await context.addCookies([{ name: SESSION_COOKIE, value: sessionSecret(), url: baseURL }]);
    await provide(context);
  },
});
