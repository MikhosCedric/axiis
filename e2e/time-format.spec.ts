import { expect, type Page } from "@playwright/test";
import { pinClock, signedIn } from "./session";

// Time format on the real signed-in routes. playwright.config.ts pins the clock cookie to 24-hour for every
// other spec; these tests change it. The item is planned in March 2099, a month no other spec reads.

const TITLE = "Board call";

// The Today grid hides the hour label the now line is within 14 minutes of, and an empty day draws only the hours
// around now. So the specs below pin the app's now (pinClock) to times either side of noon and of midnight, and
// read every label the axis draws instead of looking for one hour.
const PINS = ["00:05", "11:50", "12:00", "12:10", "23:55"] as const;
const labels = (page: Page) => page.locator("[data-hour]").evaluateAll((spans) => spans.map((s) => s.textContent ?? ""));
const every = (texts: string[], shape: RegExp) => texts.length > 0 && texts.every((t) => shape.test(t));
const timeFormat = (page: Page) => page.getByRole("group", { name: "Time format" });

async function choose(page: Page, name: "Auto" | "12-hour" | "24-hour") {
  await page.goto("/settings");
  await timeFormat(page).getByRole("button", { name }).click();
  await expect(timeFormat(page).getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
}

signedIn.describe("time format", () => {
  signedIn.use({ timezoneId: "UTC", locale: "en-US" });

  signedIn("12-hour writes the Day, Week, Month, detail panel and capture in AM and PM, and is kept on reload", async ({ page }) => {
    await choose(page, "12-hour");

    await page.goto("/inbox");
    const field = page.locator("#capture");
    await field.fill(`${TITLE} 2099-03-10 21:30 for 45m`);
    await expect(page.locator("#capture-preview")).toHaveText(/Tuesday 10 March, 9:30\sPM to 10:15\sPM$/);
    await field.press("Enter");
    await expect(page.locator("#capture-status")).toHaveText(/Planned for Tuesday 10 March, 9:30\sPM to 10:15\sPM\./);

    await page.goto("/day/2099-03-10");
    const beam = page.getByRole("button", { name: new RegExp(`^${TITLE}[ ,].*9:30\\sPM.*10:15\\sPM`) });
    await expect(beam).toBeVisible();
    const axis = page.locator("[data-hour]");
    await expect(axis.filter({ hasText: /^9\sPM$/ })).toHaveCount(1);
    await expect(axis.filter({ hasText: /^12\sPM$/ })).toHaveCount(1);
    // The labels keep to the hour they mark: each is narrower than the 56px gutter.
    for (const width of await axis.evaluateAll((spans) => spans.map((s) => s.scrollWidth))) expect(width).toBeLessThan(56);

    await beam.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("complementary");
    await expect(panel.getByRole("button", { name: /^Planned for/ })).toHaveText("Tue 10 Mar 2099");
    await expect(panel.getByLabel("Starts at")).toHaveValue(/^9:30\sPM$/);
    await expect(panel.getByLabel("Ends at")).toHaveValue(/^10:15\sPM$/);
    await panel.getByLabel("Ends at").fill("23:00");
    await panel.getByLabel("Ends at").press("Enter");
    await expect(panel.getByLabel("Ends at")).toHaveValue(/^11:00\sPM$/);
    await expect(panel.getByLabel("Starts at")).toHaveValue(/^9:30\sPM$/);

    await page.goto("/week/2099-03-10");
    await expect(page.getByRole("button", { name: new RegExp(`^${TITLE}[ ,]`) })).toContainText(/9:30\sPM/);

    await page.goto("/month/2099-03");
    const mark = page.getByRole("gridcell", { name: /^Tuesday 10 March/ }).getByRole("button", { name: new RegExp(`${TITLE}, `) });
    await expect(mark).toContainText(/9:30\sPM/);

    await page.reload();
    await expect(mark).toContainText(/9:30\sPM/);

    await choose(page, "24-hour");
    await page.goto("/month/2099-03");
    await expect(mark).toContainText("21:30");
    await page.goto("/day/2099-03-10");
    await expect(page.getByRole("button", { name: new RegExp(`^${TITLE}[ ,].*21:30.*23:00`) })).toBeVisible();
  });

  for (const at of PINS) {
    signedIn(`Auto follows the browser's language and region (now ${at})`, async ({ page, context, baseURL }) => {
      await pinClock(context, at, baseURL!);
      await context.clearCookies({ name: "clock" });
      await page.goto("/today");
      // An en-US browser writes the 12-hour clock: the sync reports it and the page is drawn again.
      await expect.poll(async () => every(await labels(page), /^(1[0-2]|[1-9])\s[AP]M$/)).toBe(true);
      await choose(page, "Auto");
    });
  }
});

signedIn.describe("time format in a 24-hour region", () => {
  signedIn.use({ timezoneId: "UTC", locale: "en-GB" });

  for (const at of PINS) {
    signedIn(`Auto writes the 24-hour clock (now ${at})`, async ({ page, context, baseURL }) => {
      await pinClock(context, at, baseURL!);
      await context.clearCookies({ name: "clock" });
      await page.goto("/settings");
      await expect(timeFormat(page).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
      await page.goto("/today");
      await expect.poll(async () => every(await labels(page), /^\d{2}$/)).toBe(true);
      // The pin took: the 12 label is hidden exactly when the pinned now is within 14 minutes of noon.
      const [h, m] = at.split(":").map(Number);
      const noon = page.locator('[data-hour="12"]');
      if (Math.abs(h * 60 + m - 720) < 14) await expect(noon).toBeHidden();
      else if (await noon.count()) await expect(noon).toBeVisible();
    });
  }
});
