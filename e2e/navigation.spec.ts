import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The navigation account is a busy week of its own (docs/e2e-session.md), seeded around the server's real today in
// the server's zone, so these tests can plan and tick without touching what the orientation tests read.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ACCOUNT = "navigation";

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=${ACCOUNT}` } });

signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([
    { name: "axiis-e2e-account", value: ACCOUNT, url: baseURL },
    { name: "tz", value: zone, url: baseURL },
    { name: "tour", value: "done", url: baseURL },
  ]);
});

const details = (page: Page) => page.getByRole("complementary", { name: "Details" });

signedIn.describe("the detail panel and history", () => {
  signedIn("Escape closes the panel from a list page and focus goes back to the row", async ({ page }) => {
    await page.goto("/inbox");
    const row = page.getByRole("button", { name: "Book flights to Lisbon", exact: true });
    await row.click();
    await expect(details(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]item=/);

    await page.keyboard.press("Escape");
    await expect(details(page)).toBeHidden();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(row).toBeFocused();
  });

  signedIn("Back closes the panel, Forward opens it again, and switching items does not add steps", async ({ page }) => {
    await page.goto("/due");
    await page.goto("/inbox");
    await page.getByRole("button", { name: "Book flights to Lisbon", exact: true }).click();
    await expect(details(page)).toBeVisible();
    await page.getByRole("button", { name: "Read the lease", exact: true }).click();
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Read the lease");

    await page.goBack();
    await expect(details(page)).toBeHidden();
    await expect(page).toHaveURL(/\/inbox$/);

    await page.goForward();
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Read the lease");

    // Closing with the button steps back too, so one more Back leaves the Inbox.
    await details(page).getByRole("link", { name: "Close details" }).click();
    await expect(details(page)).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/due$/);
  });

  signedIn("a link with ?item= opens the panel, and closing it stays on the page", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByRole("button", { name: "Pick a birthday gift", exact: true }).click();
    await expect(page).toHaveURL(/[?&]item=/);
    const url = page.url();

    await page.goto("/today");
    await page.goto(url);
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Pick a birthday gift");
    await page.keyboard.press("Escape");
    await expect(details(page)).toBeHidden();
    await expect(page).toHaveURL(/\/inbox$/);
  });
});
