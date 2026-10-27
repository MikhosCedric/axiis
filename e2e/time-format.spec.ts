import { expect, type Page } from "@playwright/test";
import { signedIn } from "./session";

// Time format on the real signed-in routes. playwright.config.ts pins the clock cookie to 24-hour for every
// other spec; these tests change it. The item is planned in March 2099, a month no other spec reads.

const TITLE = "Board call";
const timeFormat = (page: Page) => page.getByRole("group", { name: "Time format" });

async function choose(page: Page, name: "Auto" | "12-hour" | "24-hour") {
  await page.goto("/settings");
  await timeFormat(page).getByRole("button", { name }).click();
  await expect(timeFormat(page).getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
}

signedIn.describe("time format", () => {
  signedIn.use({ timezoneId: "UTC", locale: "en-US" });

  signedIn("12-hour writes the Score, Week, Month, detail panel and capture in AM and PM, and is kept on reload", async ({ page }) => {
    await choose(page, "12-hour");
    await expect(page.getByText("Like 9:30 AM and 2:15 PM.")).toBeVisible();

    await page.goto("/inbox");
    const field = page.locator("#capture");
    await field.fill(`${TITLE} 2099-03-10 21:30 for 45m`);
    await expect(page.locator("#capture-preview")).toHaveText(/Tuesday 10 March, 9:30\sPM to 10:15\sPM$/);
    await field.press("Enter");
    await expect(page.locator("#capture-status")).toHaveText(/Planned for Tuesday 10 March, 9:30\sPM to 10:15\sPM\./);

    await page.goto("/day/2099-03-10");
    const beam = page.getByRole("button", { name: new RegExp(`^${TITLE}, 9:30\\sPM, ends 10:15\\sPM, `) });
    await expect(beam).toBeVisible();
    const axis = page.locator("[data-hour]");
    await expect(axis.filter({ hasText: /^9\sPM$/ })).toHaveCount(1);
    await expect(axis.filter({ hasText: /^12\sPM$/ })).toHaveCount(1);
    // The labels keep to the hour they mark: each is narrower than the 76px an hour takes.
    for (const width of await axis.evaluateAll((spans) => spans.map((s) => s.scrollWidth))) expect(width).toBeLessThan(76);

    await beam.click();
    const panel = page.getByRole("complementary");
    await expect(panel.getByText(/^Tuesday 10 March, 9:30\sPM to 10:15\sPM$/)).toBeVisible();
    await expect(panel.getByLabel("Starts at")).toHaveValue(/^9:30\sPM$/);
    await expect(panel.getByLabel("Ends at")).toHaveValue(/^10:15\sPM$/);
    await panel.getByLabel("Ends at").fill("23:00");
    await panel.getByLabel("Ends at").press("Enter");
    await expect(panel.getByLabel("Ends at")).toHaveValue(/^11:00\sPM$/);
    await expect(panel.getByText(/^Tuesday 10 March, 9:30\sPM to 11:00\sPM$/)).toBeVisible();

    await page.goto("/week/2099-03-10");
    await expect(page.getByRole("button", { name: new RegExp(`^${TITLE}, `) })).toContainText(/9:30\sPM/);

    await page.goto("/month/2099-03");
    const mark = page.getByRole("gridcell", { name: /^Tuesday 10 March/ }).getByRole("button", { name: new RegExp(`${TITLE}, `) });
    await expect(mark).toContainText(/9:30\sPM/);

    await page.reload();
    await expect(mark).toContainText(/9:30\sPM/);

    await choose(page, "24-hour");
    await page.goto("/month/2099-03");
    await expect(mark).toContainText("21:30");
    await page.goto("/day/2099-03-10");
    await expect(page.getByRole("button", { name: new RegExp(`^${TITLE}, 21:30, ends 23:00, `) })).toBeVisible();
  });

  signedIn("Auto follows the browser's language and region", async ({ page, context }) => {
    await context.clearCookies({ name: "clock" });
    await page.goto("/today");
    // An en-US browser writes the 12-hour clock: the sync reports it and the page is drawn again.
    await expect(page.locator("[data-hour]").filter({ hasText: /^12\sPM$/ })).toHaveCount(1);
    await choose(page, "Auto");
    await expect(page.getByText(/so 9:30\sAM and 2:15\sPM\.$/)).toBeVisible();
  });
});

signedIn.describe("time format in a 24-hour region", () => {
  signedIn.use({ timezoneId: "UTC", locale: "en-GB" });

  signedIn("Auto writes the 24-hour clock", async ({ page, context }) => {
    await context.clearCookies({ name: "clock" });
    await page.goto("/settings");
    await expect(timeFormat(page).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("so 09:30 and 14:15.", { exact: false })).toBeVisible();
    await page.goto("/today");
    await expect(page.locator("[data-hour]").filter({ hasText: /^12$/ })).toHaveCount(1);
  });
});
