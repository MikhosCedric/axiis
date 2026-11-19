import { expect, type APIRequestContext } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=busy` } });

// The busy account is shared by every worker, and this test moves its items, so it runs alone.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.describe("Plan the rest of today for tomorrow", () => {
  signedIn.beforeEach(async ({ page, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await page.context().addCookies([{ name: "axiis-e2e-account", value: "busy", url: baseURL }]);
  });

  signedIn("moves the open tasks to tomorrow in one note, and Undo puts them back", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/today");
    await hydrated(page);
    const plan = page.getByRole("button", { name: "Plan the rest of today for tomorrow" });
    await expect(plan).toBeVisible();
    await plan.click();
    // Call the plumber, Send the invoice and Groceries: the event, the live block and what is done stay.
    await expect(page.getByText("3 things are planned for tomorrow.")).toBeVisible();
    await expect(plan).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Done: Send the invoice" })).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Back on today.")).toBeVisible();
    await expect(plan).toBeVisible();
  });

  signedIn("is not offered on another day", async ({ page }) => {
    await page.goto("/day/2099-05-20");
    await hydrated(page);
    await expect(page.getByRole("button", { name: "Plan the rest of today for tomorrow" })).toHaveCount(0);
  });
});
