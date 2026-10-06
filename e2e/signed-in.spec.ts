import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SESSION_COOKIE, sessionHeader, signedIn } from "./session";

// The real signed-in routes, as the in-memory account from src/lib/supabase/fake-account.ts. See docs/e2e-session.md.

test("a wrong session cookie is sent to sign in like any stranger", async ({ context, page, baseURL }) => {
  await context.addCookies([{ name: SESSION_COOKIE, value: "0".repeat(64), url: baseURL }]);
  await page.goto("/today");
  await expect(page).toHaveURL("/login?next=%2Ftoday");
});

test("the reset route answers 404 without the session", async ({ request }) => {
  expect((await request.post("/dev/e2e-session")).status()).toBe(404);
});

signedIn.describe("signed in", () => {
  signedIn.use({ timezoneId: "UTC" });

  signedIn("the landing page and /login send the account to Today", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/today");
    await page.goto("/login");
    await expect(page).toHaveURL("/today");
  });

  signedIn("the nav rail reaches every screen", async ({ page }) => {
    await page.goto("/today");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const [label, path, heading] of [
      ["Week", "/week", null],
      ["Inbox", "/inbox", "Inbox"],
      ["Lists", "/lists", "Lists"],
      ["Tags", "/tags", "Tags"],
      ["Notes", "/notes", "Notes"],
      ["Search", "/search", "Search"],
      ["Settings", "/settings", "Settings"],
      ["Today", "/today", null],
    ] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1, ...(heading && { name: heading }) })).toBeVisible();
    }
  });

  signedIn("a task captured on Today waits in the Inbox, and planned for tomorrow it shows on that day", async ({ page }) => {
    const title = `Call the plumber ${Date.now()}`;
    await page.goto("/today");
    await page.getByLabel("Capture anything").fill(title);
    await page.getByLabel("Capture anything").press("Enter");
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto("/inbox");
    const list = page.getByRole("region", { name: "Waiting for a day" });
    await list.getByRole("button", { name: `Plan for: ${title}` }).click();
    await list.getByRole("group", { name: `Plan ${title} for` }).getByRole("button", { name: "Tomorrow" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${title} is planned for` })).toBeVisible();
    await expect(list.getByRole("button", { name: `Plan for: ${title}` })).toHaveCount(0);

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/day/${tomorrow}`);
    await expect(page.getByText(title).first()).toBeVisible();
  });

  signedIn("Lists and Tags show the account's checklist and tag", async ({ page }) => {
    await page.goto("/lists");
    await expect(page.getByText("Packing for Lisbon")).toBeVisible();
    await page.goto("/tags");
    await page.getByRole("link", { name: /errands/ }).click();
    await expect(page).toHaveURL("/tags/errands");
    await expect(page.getByText("Renew passport")).toBeVisible();
  });

  signedIn("Settings names the account and exports its data", async ({ page, request }) => {
    await page.goto("/settings");
    await expect(page.getByText("Signed in as e2e@axiis.invalid")).toBeVisible();

    const exported = await request.get("/settings/export", { headers: sessionHeader() });
    expect(exported.status()).toBe(200);
    const body = await exported.json();
    expect(body.areas.map((a: { name: string }) => a.name)).toEqual(["Work", "Home", "Health"]);
    expect(body.items.map((i: { title: string }) => i.title)).toContain("Packing for Lisbon");
  });

  signedIn("signing out returns to sign in and ends the session", async ({ page }) => {
    await page.goto("/today");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/today");
    await expect(page).toHaveURL("/login?next=%2Ftoday");
  });

  for (const path of ["/today", "/inbox", "/settings"]) {
    signedIn(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
      expect(blocking).toEqual([]);
    });
  }
});
