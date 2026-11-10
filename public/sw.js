// Axiis service worker (ADR-0002, stage 2b). It keeps the last copy of the pages you read, so they open with no
// connection, and nothing else:
//  - Pages are network-first. Online you always get the server's page; the copy is only used when the network
//    fails. Pages that write or hold account details (Settings, sign-in, API routes) are never kept.
//  - Everything is dropped when you sign out or reach the sign-in page, so a shared device keeps nothing.
//  - Server Actions are POSTs and never touch this worker; offline they fail and the app says so.
const VERSION = "v1";
const PAGES = `axiis-pages-${VERSION}`;
const STATIC = `axiis-static-${VERSION}`;
const SAVED_HEADER = "x-axiis-saved";
const MAX_PAGES = 40;
const MAX_STATIC = 400;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// The reading views. A path matches when it is one of these or sits under one.
const READABLE = ["/today", "/inbox", "/week", "/month", "/due", "/lists", "/notes", "/day", "/tags", "/search"];

function readable(pathname) {
  return READABLE.some((root) => pathname === root || pathname.startsWith(root + "/"));
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("axiis-") && name !== PAGES && name !== STATIC) await caches.delete(name);
      }
      await purgeExpired().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

async function dropEverything() {
  for (const name of await caches.keys()) if (name.startsWith("axiis-")) await caches.delete(name);
}

/** Deletes saved pages older than the age limit, so a copy does not outlive it just because it is never read. */
async function purgeExpired() {
  const cache = await caches.open(PAGES);
  for (const request of await cache.keys()) {
    const saved = await cache.match(request);
    const at = saved ? Number(saved.headers.get(SAVED_HEADER)) : 0;
    if (!saved || !(Date.now() - at < MAX_AGE_MS)) await cache.delete(request);
  }
}

/** Keeps at most `max` entries, dropping the oldest saved. */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

function isHtml(response) {
  return (response.headers.get("content-type") || "").includes("text/html");
}

async function savePage(url, response) {
  const cache = await caches.open(PAGES);
  const headers = new Headers(response.headers);
  headers.set(SAVED_HEADER, String(Date.now()));
  const body = await response.blob();
  // Replacing an entry moves it to the end, so the oldest-first trim above drops the page visited longest ago.
  await cache.delete(url);
  await cache.put(url, new Response(body, { status: response.status, statusText: response.statusText, headers }));
  await trim(cache, MAX_PAGES);
  await purgeExpired().catch(() => {});
}

function offlinePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Axiis is offline</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText}main{max-width:26rem;padding:2rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0 0 1.25rem;opacity:.75}a{display:inline-block;padding:.55rem 1.1rem;border-radius:999px;border:1px solid currentColor;color:inherit;text-decoration:none;font-weight:600}</style></head><body><main><h1>Axiis is offline</h1><p>This page has not been saved on this device. Pages you opened lately open without a connection; this one needs one.</p><a href="/today">Open Today</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function pageFor(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && isHtml(response)) {
      // Do not hold the answer back for the copy.
      const copy = response.clone();
      void savePage(url.href, copy);
    }
    return response;
  } catch {
    const saved = await (await caches.open(PAGES)).match(url.href);
    const at = saved ? Number(saved.headers.get(SAVED_HEADER)) : 0;
    if (saved && Date.now() - at < MAX_AGE_MS) return saved;
    return offlinePage();
  }
}

async function staticFor(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    void cache.put(request, response.clone()).then(() => trim(cache, MAX_STATIC));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === "POST" && url.pathname === "/auth/signout") {
    event.waitUntil(dropEverything());
    return;
  }
  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticFor(request));
    return;
  }
  if (request.mode !== "navigate") return;

  if (url.pathname === "/login") {
    // Whoever reaches the sign-in page is signed out or about to be someone else.
    event.waitUntil(dropEverything());
    return;
  }
  if (readable(url.pathname)) {
    event.respondWith(pageFor(request));
    return;
  }
  // Any other page needs the network; say so plainly instead of the browser's error.
  event.respondWith(fetch(request).catch(() => offlinePage()));
});

/** A path compared the way tag names are: decoded and in any case. */
function samePath(a, b) {
  const plain = (p) => {
    try {
      return decodeURIComponent(p).toLowerCase();
    } catch {
      return p.toLowerCase();
    }
  };
  return plain(a) === plain(b);
}

/** Drops every saved copy of a page that no longer exists (a deleted or renamed tag's), with any query. */
async function forgetPage(path) {
  const cache = await caches.open(PAGES);
  for (const request of await cache.keys()) {
    if (samePath(new URL(request.url).pathname, path)) await cache.delete(request);
  }
}

// The page asks to keep itself on its first visit, when this worker did not yet control it, and to forget
// a page that its own change has removed.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "forget-all") {
    // The page saw it is signed out (session gone or expired): nothing read while signed in stays.
    event.waitUntil(dropEverything().catch(() => {}));
    return;
  }
  if (data && data.type === "forget" && typeof data.path === "string" && data.path.startsWith("/")) {
    event.waitUntil(forgetPage(data.path).catch(() => {}));
    return;
  }
  if (!data || data.type !== "keep" || typeof data.url !== "string") return;
  const url = new URL(data.url, self.location.origin);
  if (url.origin !== self.location.origin || !readable(url.pathname)) return;
  event.waitUntil(
    (async () => {
      const response = await fetch(url.href, { headers: { accept: "text/html" }, credentials: "same-origin" });
      if (response.ok && !response.redirected && isHtml(response)) await savePage(url.href, response);
    })().catch(() => {}),
  );
});
