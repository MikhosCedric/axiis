import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// A fresh secret per run for the browser-test session (docs/e2e-session.md). Set before the workers start,
// so they inherit it through the environment and send the same cookie the server expects.
process.env.E2E_FAKE_SESSION_SECRET ||= randomBytes(32).toString("hex");

const PORT = 3600;
const baseURL = `http://localhost:${PORT}`;
// No bundled browsers are downloaded: CI uses the runner's Google Chrome, and Windows can use Edge.
const channel = process.env.E2E_CHANNEL === "msedge" ? "msedge" : "chrome";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // A GitHub runner has 4 cores, and the production server needs little of them, so CI runs as many workers as a laptop.
  workers: 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Time format: Auto would follow the browser's en-US locale to the 12-hour clock. Specs read
    // 24-hour times unless they choose otherwise (e2e/time-format.spec.ts).
    storageState: {
      cookies: [{ name: "clock", value: "24", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
      origins: [],
    },
  },
  projects: [{ name: channel, use: { ...devices["Desktop Chrome"], channel } }],
  webServer: {
    // The browser-test production build: every route is compiled before the first test, and the fake
    // session and /dev harness pages exist only because AXIIS_E2E_BUILD=1 is set while building.
    command: `npx next build && npx next start -p ${PORT}`,
    url: `${baseURL}/robots.txt`,
    // Never reuse: a server started elsewhere would not hold this run's session secret or this build.
    reuseExistingServer: false,
    timeout: 600_000,
    env: {
      AXIIS_E2E_BUILD: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy",
      E2E_FAKE_SESSION: "1",
      E2E_FAKE_SESSION_SECRET: process.env.E2E_FAKE_SESSION_SECRET,
    },
  },
});
