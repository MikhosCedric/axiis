import { expect, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The saved-pages worker (public/sw.js) is on in the e2e build only with the `axiis-sw` cookie.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ACCOUNT = "navigation";
const CACHE = "axiis-pages-v1";
const DAY = 24 * 60 * 60 * 1000;

signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=${ACCOUNT}` } })).status()).toBe(204);
  await page.context().addCookies([
    { name: "axiis-e2e-account", value: ACCOUNT, url: baseURL },
    { name: "tour", value: "done", url: baseURL },
    { name: "axiis-sw", value: "1", url: baseURL },
  ]);
});

const saved = (page: Page) =>
  page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname).sort(), CACHE);

async function visit(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
}

signedIn.describe("the saved-pages worker", () => {
  signedIn("keeps a visited page, and forget-all empties the cache", async ({ page }) => {
    await visit(page, "/inbox");
    await expect.poll(() => saved(page), { timeout: 15000 }).toContain("/inbox");

    await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.postMessage({ type: "forget-all" }));
    await expect
      .poll(() => page.evaluate(() => caches.keys().then((k) => k.filter((n) => n.startsWith("axiis-pages")))), { timeout: 15000 })
      .toEqual([]);
  });

  signedIn("a copy older than seven days is removed on the next save", async ({ page }) => {
    await visit(page, "/inbox");
    await expect.poll(() => saved(page), { timeout: 15000 }).toContain("/inbox");

    // The age is the worker's own x-axiis-saved header (ms since epoch); put the copy back saved eight days ago.
    await page.evaluate(
      async ({ name, old }) => {
        const cache = await caches.open(name);
        const key = (await cache.keys()).find((r) => new URL(r.url).pathname === "/inbox")!;
        const hit = (await cache.match(key))!;
        const headers = new Headers(hit.headers);
        headers.set("x-axiis-saved", String(old));
        await cache.put(key, new Response(await hit.blob(), { status: hit.status, headers }));
      },
      { name: CACHE, old: Date.now() - 8 * DAY },
    );
    expect(await saved(page)).toContain("/inbox");

    await visit(page, "/lists");
    await expect.poll(() => saved(page), { timeout: 15000 }).toEqual(["/lists"]);
  });
});
