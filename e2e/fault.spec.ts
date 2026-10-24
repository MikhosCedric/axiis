import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hydrated, signedIn } from "./session";

// The not-found page, the error boundary, and a save that cannot reach the server.

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

function cspViolations(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) seen.push(m.text());
  });
  return seen;
}

const NONCE_POLICY = /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/;

test("the not-found page carries the nonce policy, runs under it and passes axe", async ({ page }) => {
  const violations = cspViolations(page);
  const response = await page.goto("/dev/no-such-page");
  expect(response?.status()).toBe(404);
  expect(response?.headers()["content-security-policy"]).toMatch(NONCE_POLICY);
  await expect(page.getByRole("heading", { level: 1, name: "There is nothing at this address." })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  expect(violations).toEqual([]);
});

test("a page that fails shows a calm message and Try again, never the error", async ({ page }) => {
  const violations = cspViolations(page);
  const response = await page.goto("/dev/fault");
  expect(response?.headers()["content-security-policy"]).toMatch(NONCE_POLICY);
  await expect(page.getByRole("heading", { level: 1, name: "This page did not load." })).toBeVisible();
  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Axiis" })).toHaveAttribute("href", "/");

  expect(await page.content()).not.toContain("secret-detail-4417");
  await retry.click();
  await expect(page.getByRole("heading", { level: 1, name: "This page did not load." })).toBeVisible();
  expect(await page.content()).not.toContain("secret-detail-4417");

  expect(await axe(page)).toEqual([]);
  expect(violations).toEqual([]);
});

signedIn("a save that cannot reach the server says so and keeps the page", async ({ page, context }) => {
  await page.goto("/settings");
  const areas = page.getByRole("region", { name: "Areas" });
  const field = areas.getByLabel("New area");
  await hydrated(page);

  await context.setOffline(true);
  await field.fill("Garden");
  await field.press("Enter");
  await expect(page.getByText("Could not reach Axiis. Check your connection and try again.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await context.setOffline(false);
});

signedIn("a capture that cannot reach the server keeps the typed words and says so", async ({ page, context }) => {
  await page.goto("/today");
  const field = page.locator("#capture");
  await hydrated(page);

  await context.setOffline(true);
  await field.fill("call the bank about the card");
  await field.press("Enter");
  await expect(page.locator("#capture-status")).toHaveText("Could not reach Axiis. Check your connection and try again.");
  await expect(field).toHaveValue("call the bank about the card");
  await expect(page.getByRole("heading", { level: 1, name: "This page did not load." })).toHaveCount(0);
  await context.setOffline(false);
});

signedIn("a done tick that cannot reach the server puts the item back and says so", async ({ page, context }) => {
  await page.goto("/tags/errands");
  const tick = page.getByRole("checkbox", { name: "Done: Renew passport" });
  await hydrated(page);

  await context.setOffline(true);
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").filter({ hasText: "Could not reach Axiis" })).toHaveText(
    "Could not reach Axiis. Check your connection and try again.",
  );
  await expect(tick).not.toBeChecked();
  await context.setOffline(false);
});
