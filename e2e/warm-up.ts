import type { FullConfig } from "@playwright/test";

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
  "/dev/detail",
  "/dev/notes",
  "/dev/notes/00000000-0000-4000-8000-000000000020",
  "/dev/notes/search",
  "/dev/settings",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

export default async function warmUp(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  for (const route of ROUTES) await fetch(new URL(route, baseURL), { redirect: "manual" });
}
