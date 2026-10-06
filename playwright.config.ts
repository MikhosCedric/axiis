import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// A fresh secret per run for the browser-test session (docs/e2e-session.md). Set before the workers start,
// so they inherit it through the environment and send the same cookie the dev server expects.
process.env.E2E_FAKE_SESSION_SECRET ||= randomBytes(32).toString("hex");

const PORT = 3600;
const baseURL = `http://localhost:${PORT}`;
// No bundled browsers are downloaded: CI uses the runner's Google Chrome, and Windows can use Edge.
const channel = process.env.E2E_CHANNEL === "msedge" ? "msedge" : "chrome";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/warm-up.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: channel, use: { ...devices["Desktop Chrome"], channel } }],
  webServer: {
    // Webpack, because Turbopack crashes on Windows under load. The /dev harness pages exist only outside production.
    command: `npx next dev --webpack -p ${PORT}`,
    url: `${baseURL}/robots.txt`,
    // Never reuse: a server started elsewhere would not hold this run's session secret.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy",
      E2E_FAKE_SESSION: "1",
      E2E_FAKE_SESSION_SECRET: process.env.E2E_FAKE_SESSION_SECRET,
    },
  },
});
