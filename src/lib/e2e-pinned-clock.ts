/**
 * Browser only. True when a browser test pinned the time (an `axiis-e2e-at` cookie), so the page does not tick
 * over to the real clock. The body sits inside the literal build-flag test, so a normal build drops the cookie
 * name; `npm run check:no-fake-session` proves it. The server decides what the pin means (fake-session.ts).
 */
export function clockIsPinned(): boolean {
  if (process.env.AXIIS_E2E_BUILD === "1") return typeof document !== "undefined" && /(?:^|; )axiis-e2e-at=/.test(document.cookie);
  return false;
}
