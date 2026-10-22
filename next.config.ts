import type { NextConfig } from "next";

// The browser-test build (docs/e2e-session.md). Inlined below as "1" or "", so a normal build compiles the
// fake session out. It builds into its own folder, so `next start` never serves it by accident.
const e2eBuild = process.env.AXIIS_E2E_BUILD === "1";
if (e2eBuild && process.env.VERCEL !== undefined) {
  throw new Error("AXIIS_E2E_BUILD is for the browser tests only and must never be set on Vercel.");
}

// No Content-Security-Policy here: src/proxy.ts sets the one per-request nonce policy,
// and a second header from this list would arrive alongside it.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // No other origin's window keeps a handle on an Axiis tab. Google sign-in is a full redirect, not a popup.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { AXIIS_E2E_BUILD: e2eBuild ? "1" : "" },
  distDir: e2eBuild ? ".next-e2e" : ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
