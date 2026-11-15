import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=busy` } });

// One in-memory account is shared by every worker, and these tests tick it, so they run one at a time.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

async function useBusy(page: Page, request: APIRequestContext, baseURL: string | undefined) {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([{ name: "axiis-e2e-account", value: "busy", url: baseURL }]);
}

signedIn.describe("Done", () => {
  signedIn.beforeEach(async ({ page, request, baseURL }) => useBusy(page, request, baseURL));

  signedIn("lists what was finished under its day, and unticking reopens it", async ({ page }) => {
    await page.goto("/done");
    await expect(page.getByRole("heading", { level: 1, name: "Done" })).toBeVisible();
    const today = page.getByRole("region", { name: /^Today/ });
    await expect(today.getByRole("heading", { level: 2 })).toContainText("3 items");
    await expect(today.getByText("Morning run")).toBeVisible();
    await expect(today.getByText("Write the Q4 plan")).toBeVisible();
    // No subtasks, no open items, no praise.
    await expect(page.getByText("Milk")).toHaveCount(0);
    await expect(page.getByText("Focus block")).toHaveCount(0);
    await expect(page.getByText(/!/)).toHaveCount(0);

    await hydrated(page);
    await today.getByRole("checkbox", { name: "Done: Morning run" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: "Morning run" })).toContainText("open again");
    await page.goto("/done");
    await expect(page.getByRole("region", { name: /^Today/ }).getByText("Morning run")).toHaveCount(0);
  });

  signedIn("narrows to an area, and G then F goes there", async ({ page }) => {
    await page.goto("/today");
    await hydrated(page);
    await page.keyboard.press("g");
    await page.keyboard.press("f");
    await expect(page).toHaveURL(/\/done$/);
    // A then a digit narrows the page to an area, in the side panel's order.
    await page.keyboard.press("a");
    await page.keyboard.press("3");
    await expect(page).toHaveURL(/area=/);
    await expect(page.getByText("Morning run")).toBeVisible();
    await expect(page.getByText("Write the Q4 plan")).toHaveCount(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    signedIn(`/done has no serious or critical axe violations (${scheme}, 375px)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto("/done");
      await expect(page.getByRole("heading", { level: 1, name: "Done" })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    });
  }
});
