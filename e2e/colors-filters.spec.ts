import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The larger palette, tag colours, and colour as navigation, on an in-memory account of its own whose items sit in areas
// (`axiis-e2e-account=filters`, src/lib/supabase/fake-account.ts), so no other spec resets it mid-test: "Draft the budget" in Work at 10:00 on 20 May 2099,
// "Water the ferns" in Home that day at any time, "Sort the receipts" in Work with no day. The last two carry #errands.

const DAY = "/day/2099-05-20";
const WORK = "00000000-0000-4000-a000-000000000001";
const HOME = "00000000-0000-4000-a000-000000000002";

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=filters` } });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

const rail = (page: Page) => page.getByRole("navigation", { name: "Primary" }).first();
const railArea = (page: Page, name: string) => rail(page).getByRole("region", { name: "Open today, by area" }).getByRole("link", { name: new RegExp(`^${name}`) });
const chips = (page: Page) => page.getByRole("group", { name: "Filter" });
const staffLabel = (page: Page, name: string) => page.locator("[data-staff-label]").filter({ hasText: name });
/** The Score measures its axis once React has hydrated it, so its key listeners are attached by then. */
const scoreReady = (page: Page) => page.locator("[data-axis-measured]").first().waitFor({ state: "attached" });

/** Opens the tag's picker; the button answers once React has hydrated the page, so a click before then is tried again. */
async function openTagPicker(page: Page, tag: string) {
  const group = page.getByRole("group", { name: `Colour for #${tag}` });
  await expect(async () => {
    if (!(await group.isVisible())) await page.getByRole("button", { name: new RegExp(`^Colour for #${tag}: `) }).click();
    await expect(group).toBeVisible({ timeout: 1000 });
  }).toPass();
  return group;
}

// One account for the whole file, so its tests run one at a time: each starts by resetting it.
signedIn.describe.configure({ mode: "serial" });

signedIn.describe("colours and filters", () => {
  signedIn.describe.configure({ mode: "serial" });
  signedIn.use({ timezoneId: "UTC", viewport: { width: 1440, height: 900 } });

  signedIn.beforeEach(async ({ context, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await context.addCookies([{ name: "axiis-e2e-account", value: "filters", url: baseURL }]);
  });

  signedIn("an area in the rail narrows the day, and day, week and month links keep it", async ({ page }) => {
    await page.goto(DAY);
    await expect(chips(page)).toHaveCount(0);
    await railArea(page, "Work").click();
    await expect(page).toHaveURL(new RegExp(`${DAY}\\?area=${WORK}$`));
    await expect(chips(page)).toContainText(/Showing only *Work/);
    await expect(railArea(page, "Work")).toHaveAttribute("aria-current", "true");
    await expect(staffLabel(page, "Work")).toBeVisible();
    await expect(staffLabel(page, "Home")).toHaveCount(0);
    await expect(page.getByText("Water the ferns")).toHaveCount(0);
    await expect(page.locator("[data-glance]")).toContainText("done in Work");

    await page.getByRole("navigation", { name: "Day" }).getByRole("link", { name: /Next day/ }).click();
    await expect(page).toHaveURL(new RegExp(`/day/2099-05-21\\?area=${WORK}$`));
    await expect(chips(page)).toContainText("Work");

    await page.getByRole("navigation", { name: "Day" }).getByRole("link", { name: "Week" }).click();
    await expect(page).toHaveURL(new RegExp(`/week/2099-05-18\\?area=${WORK}$`));
    await page.getByRole("navigation", { name: "Week" }).getByRole("link", { name: /Previous week/ }).click();
    await page.getByRole("navigation", { name: "Week" }).getByRole("link", { name: /Next week/ }).click();
    await expect(page).toHaveURL(new RegExp(`/week/2099-05-18\\?area=${WORK}$`));
    await expect(page.getByRole("button", { name: /^Draft the budget/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Water the ferns/ })).toHaveCount(0);
    await expect(page.locator(".page-summary").first()).toContainText("open in Work");

    // A place in the rail keeps the filter where the place can show it.
    for (const place of ["Inbox", "Due", "Lists", "Month"]) {
      await rail(page).getByRole("link", { name: place, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`area=${WORK}`));
      await expect(chips(page)).toContainText("Work");
    }
    await rail(page).getByRole("link", { name: "Inbox", exact: true }).click();
    await expect(page.getByText("Sort the receipts")).toBeVisible();
    await expect(page.locator(".page-summary")).toContainText("In Work:");
  });

  signedIn("the chip and the rail both widen back to every area, and an unknown area is ignored", async ({ page }) => {
    await page.goto(`/week/2099-05-18?area=${WORK}`);
    await page.getByRole("link", { name: "Stop showing only Work" }).click();
    await expect(page).toHaveURL(/\/week\/2099-05-18$/);
    await expect(chips(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Water the ferns/ })).toBeVisible();

    await page.goto(`${DAY}?area=${HOME}`);
    await expect(staffLabel(page, "Work")).toHaveCount(0);
    await railArea(page, "Home").click();
    await expect(page).toHaveURL(new RegExp(`${DAY}$`));
    await expect(staffLabel(page, "Work")).toBeVisible();

    for (const odd of ["00000000-0000-4000-a000-000000000999", "not-an-id", ""]) {
      await page.goto(`${DAY}?area=${odd}`);
      await expect(chips(page)).toHaveCount(0);
      await expect(staffLabel(page, "Home")).toBeVisible();
      await expect(staffLabel(page, "Work")).toBeVisible();
    }
  });

  signedIn("a tag narrows the day and the Inbox, and A then a digit or the palette choose an area", async ({ page }) => {
    await page.goto(`${DAY}?tag=errands`);
    await expect(chips(page)).toContainText("#errands");
    await expect(page.getByRole("button", { name: /^Water the ferns/ })).toBeVisible();
    await expect(page.locator(`[data-item="e2e00000-0000-4000-8000-000000000021"]`)).toHaveCount(0);
    await page.getByRole("link", { name: "Stop showing only #errands" }).click();
    await expect(page).toHaveURL(new RegExp(`${DAY}$`));

    await scoreReady(page);
    await page.locator("body").press("a");
    await page.locator("body").press("2");
    await expect(page).toHaveURL(new RegExp(`${DAY}\\?area=${HOME}$`));
    await page.locator("body").press("a");
    await page.locator("body").press("0");
    await expect(page).toHaveURL(new RegExp(`${DAY}$`));

    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await palette.getByRole("combobox").fill("show only work");
    await expect(palette.getByRole("option", { name: /Show only Work/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${DAY}\\?area=${WORK}$`));
  });

  signedIn("a tag's colour is picked in Settings, kept, and shown beside the tag", async ({ page }) => {
    await page.goto("/settings");
    const tags = page.getByRole("region", { name: "Tags" });
    await expect(tags.getByRole("button", { name: "Colour for #errands: None" })).toBeVisible();
    const group = await openTagPicker(page, "errands");
    await expect(group.getByRole("radio")).toHaveCount(13);
    await group.getByRole("radio", { name: "Indigo" }).check();
    await expect(tags.getByRole("button", { name: "Colour for #errands: Indigo" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Tags" }).getByRole("button", { name: "Colour for #errands: Indigo" })).toBeVisible();

    await page.goto("/inbox");
    await expect(page.locator("main [data-area-color='indigo']").first()).toBeVisible();
    await page.goto("/tags/errands");
    await expect(page.getByRole("heading", { level: 1 }).locator("[data-area-color]")).toHaveAttribute("data-area-color", "indigo");
    await page.goto("/tags");
    await expect(page.getByRole("link", { name: /errands/ }).locator("[data-area-color]")).toHaveAttribute("data-area-color", "indigo");
  });

  signedIn("Settings suggests colours once, until Not now", async ({ page }) => {
    await page.goto("/settings");
    const hint = page.locator("[data-color-hint]");
    await expect(hint).toContainText("Give your areas a colour");
    await expect(async () => {
      if (await hint.isVisible()) await hint.getByRole("button", { name: "Not now" }).click();
      await expect(hint).toHaveCount(0, { timeout: 1000 });
    }).toPass();
    await page.reload();
    await expect(page.locator("[data-color-hint]")).toHaveCount(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    signedIn(`a filtered day, the Settings pickers and the Guide's colour key pass axe in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${DAY}?area=${WORK}`);
      await expect(chips(page)).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto("/settings");
      await openTagPicker(page, "errands");
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("?");
      await expect(page.getByRole("list", { name: "What the colours mean" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }
});

signedIn.describe("colours and filters on a phone", () => {
  signedIn.use({ timezoneId: "UTC", viewport: { width: 375, height: 812 } });

  signedIn.beforeEach(async ({ context, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await context.addCookies([{ name: "axiis-e2e-account", value: "filters", url: baseURL }]);
  });

  signedIn("More holds the areas, and choosing one narrows the page", async ({ page }) => {
    await page.goto(DAY);
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(async () => {
      if (!(await sheet.isVisible())) await page.getByRole("button", { name: "More" }).click();
      await expect(sheet).toBeVisible({ timeout: 1000 });
    }).toPass();
    const work = sheet.getByRole("link", { name: /^Work/ });
    await expect(work).toBeVisible();
    expect((await work.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await axe(page)).toEqual([]);
    await work.click();
    await expect(page).toHaveURL(new RegExp(`${DAY}\\?area=${WORK}$`));
    await expect(chips(page)).toContainText("Work");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
    await page.getByRole("link", { name: "Stop showing only Work" }).click();
    await expect(page).toHaveURL(new RegExp(`${DAY}$`));
  });
});
