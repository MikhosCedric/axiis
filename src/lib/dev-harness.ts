/**
 * Whether the /dev harness pages exist: in `next dev`, and in the browser-test build (`AXIIS_E2E_BUILD=1`,
 * inlined by next.config.ts). A normal production build has neither, so the pages answer 404.
 */
export function devHarnessEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.AXIIS_E2E_BUILD === "1";
}
