import { expect, test } from "@playwright/test";

test("the landing page shows the pitch, the sample day and a way in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Your tasks and your time, on one page." })).toBeVisible();
  await expect(page.getByRole("figure", { name: /A sample day/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute("href", "/login");
});

test("the landing page lists shipped features as shipped, and nothing as coming", async ({ page }) => {
  await page.goto("/");
  const today = page.getByRole("region", { name: "What it does today" }).getByRole("listitem");
  for (const shipped of [/repeat/, /inbox/, /Checklists/, /Tags/, /command palette/]) {
    await expect(today.filter({ hasText: shipped })).toHaveCount(1);
  }
  await expect(page.getByRole("heading", { name: "Coming" })).toHaveCount(0);
  await expect(page.getByText(/come next/)).toHaveCount(0);
});

for (const path of ["/today", "/day/2026-10-08", "/week", "/inbox", "/settings", "/notes", "/tags", "/tags/Deep%20work"]) {
  test(`${path} sends a stranger to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("heading", { name: "Sign in to Axiis" })).toBeVisible();
  });
}

test("the export route answers a stranger with a redirect, not data", async ({ request }) => {
  const response = await request.get("/settings/export", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toBe("/login?next=%2Fsettings%2Fexport");
  expect(response.headers()["content-disposition"]).toBeUndefined();
});

test("sign in rejects an address that is not an email, accessibly", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Email address");
  await expect(email).toBeVisible();
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  const error = page.getByRole("alert").filter({ hasText: "Enter an email address like name@example.com." });
  await expect(error).toBeVisible();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription("Enter an email address like name@example.com.");
  await expect(email).toHaveValue("not-an-email");
});

for (const [path, title] of [
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
] as const) {
  test(`${path} is marked as a draft with its blanks visible`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(title) })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Draft.");
    await expect(page.locator("mark").filter({ hasText: "[Effective date]" })).toBeVisible();
  });
}

test("an unknown address shows the not-found page", async ({ page }) => {
  // Signed out, an unknown app path is sent to sign in first; /dev is public in development, so it reaches not-found.
  const response = await page.goto("/dev/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "There is nothing at this address." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Axiis" })).toHaveAttribute("href", "/");
});

test("robots.txt keeps crawlers out of the app and points at the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Disallow: /today");
  expect(body).toContain("Disallow: /settings");
  expect(body).toMatch(/Sitemap: \S+\/sitemap\.xml/);
});

test("sitemap.xml lists only the public pages", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(locs.sort()).toEqual(["/", "/privacy", "/terms"]);
});

test("the web manifest names the app and starts on today", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ short_name: "Axiis", start_url: "/today", display: "standalone" });
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test("pages carry the security headers", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-powered-by"]).toBeUndefined();
});

for (const path of ["/dev/score", "/dev/week", "/dev/inbox", "/dev/detail", "/dev/notes", "/dev/settings"]) {
  test(`${path} is reachable in development`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(path);
  });
}
