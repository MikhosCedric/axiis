import { defineConfig, devices } from "@playwright/test";

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
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy",
    },
  },
});
