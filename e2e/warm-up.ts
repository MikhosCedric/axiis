import type { FullConfig } from "@playwright/test";
import { sessionHeader } from "./session";

// `next dev` compiles each route on its first request. Compiling them one at a time up front keeps that
// cost out of individual test timeouts, where parallel cold compiles would otherwise race the clock.
const ROUTES = [
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/dev/no-such-page",
  "/dev/score",
  "/dev/week",
  "/dev/inbox",
  "/dev/lists",
  "/dev/tags",
  "/dev/tags/errands",
  "/dev/detail",
  "/dev/notes",
  "/dev/notes/00000000-0000-4000-8000-000000000020",
  "/dev/notes/search",
  "/dev/settings",
  "/dev/palette",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

// The real signed-in routes, fetched with the browser-test session so they compile instead of redirecting.
const SIGNED_IN_ROUTES = [
  "/today",
  "/day/2026-10-08",
  "/week",
  "/inbox",
  "/due",
  "/lists",
  "/notes",
  "/tags",
  "/tags/errands",
  "/search",
  "/settings",
];

export default async function warmUp(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  for (const route of ROUTES) await fetch(new URL(route, baseURL), { redirect: "manual" });
  for (const route of SIGNED_IN_ROUTES) await fetch(new URL(route, baseURL), { redirect: "manual", headers: sessionHeader() });
  // Signing out is a POST-only route handler, so no page fetch compiles it; its first call inside a test used to race the timeout.
  await fetch(new URL("/auth/signout", baseURL), { method: "POST", redirect: "manual", headers: sessionHeader() });
  const reset = await fetch(new URL("/dev/e2e-session", baseURL), { method: "POST", headers: sessionHeader() });
  if (reset.status !== 204) throw new Error(`resetting the browser-test account answered ${reset.status}`);
}
