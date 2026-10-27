import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// Account deletion with a 14-day undo, on the in-memory account kept for it (`axiis-e2e-account=deletion`).

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=deletion` } });

/** The day 14 days from now in UTC, as the banner writes it: "Friday 6 November", with the year when it is not this year's. */
function dueDay(): string {
  const now = new Date();
  const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(due);
  return due.getUTCFullYear() === now.getUTCFullYear() ? day : `${day} ${due.getUTCFullYear()}`;
}

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

const banner = (page: Page) => page.getByRole("region", { name: "Account deletion" });

signedIn.describe("account deletion", () => {
  signedIn.describe.configure({ mode: "serial" });
  signedIn.use({ timezoneId: "UTC" });

  signedIn.beforeEach(async ({ context, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await context.addCookies([{ name: "axiis-e2e-account", value: "deletion", url: baseURL }]);
  });

  signedIn("is scheduled 14 days out, shown on every page, and undone from the banner", async ({ page }) => {
    await page.goto("/settings");
    await expect(banner(page)).toHaveCount(0);
    const schedule = page.getByRole("button", { name: "Delete my account in 14 days" });
    await expect(async () => {
      await schedule.click();
      await expect(banner(page)).toBeVisible({ timeout: 1000 });
    }).toPass();

    const sentence = `Your account is scheduled for deletion on ${dueDay()}.`;
    await expect(banner(page)).toContainText(sentence);
    await expect(page.getByRole("button", { name: "Undo deletion" })).toBeVisible();

    for (const path of ["/today", "/inbox", "/notes"]) {
      await page.goto(path);
      await expect(banner(page)).toContainText(sentence);
    }
    expect(await axe(page)).toEqual([]);

    await banner(page).getByRole("button", { name: "Undo" }).click();
    await expect(banner(page)).toHaveCount(0);
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Delete my account in 14 days" })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  signedIn("can still be done at once with the typed phrase", async ({ page }) => {
    await page.goto("/settings");
    const now = page.getByRole("form", { name: "Delete now" });
    const deleteNow = now.getByRole("button", { name: "Delete now" });
    await expect(deleteNow).toHaveAttribute("aria-disabled", "true");
    await now.getByLabel("To confirm, type delete my account").fill("delete my account");
    await deleteNow.click();
    await expect(page).toHaveURL(/\/login\?deleted=1$/);
    await expect(page.getByRole("status").filter({ hasText: "Your account" })).toContainText("Your account and its data are gone.");
  });
});
