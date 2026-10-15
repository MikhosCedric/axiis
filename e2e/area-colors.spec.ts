import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// Area colours on the real signed-in routes, as the in-memory account whose items sit in areas
// (`axiis-e2e-account=areas`, src/lib/supabase/fake-account.ts): "Draft the budget" in Work at 10:00 on
// 20 May 2099, "Water the ferns" in Home on that day at any time, "Sort the receipts" in Work with no day.

const DAY = "/day/2099-05-20";
const BUDGET = "e2e00000-0000-4000-8000-000000000021";
const CLAY = { light: "rgb(150, 75, 44)", dark: "rgb(213, 132, 100)" };
const MOSS = { light: "rgb(72, 83, 32)", dark: "rgb(122, 135, 83)" };

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=areas` } });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

const dot = (scope: Locator) => scope.locator("[data-area-color]");
const fill = (scope: Locator) => dot(scope).first().evaluate((el) => getComputedStyle(el).backgroundColor);
const staffLabel = (page: Page, name: string) => page.locator("[data-staff-label]").filter({ hasText: name });

async function colourWorkAndHome(page: Page) {
  await page.goto("/settings");
  const areas = page.getByRole("region", { name: "Areas" });
  await areas.getByRole("button", { name: "Colour for Work: None" }).click();
  const work = page.getByRole("group", { name: "Colour for Work" });
  await expect(work.getByRole("radio")).toHaveCount(9);
  await expect(work.getByRole("radio", { name: "None" })).toBeChecked();
  await work.getByRole("radio", { name: "Clay" }).check();
  await expect(areas.getByRole("button", { name: "Colour for Work: Clay" })).toBeVisible();

  // Keyboard: arrows walk the native radio group from None to Clay, Ochre and Moss, choosing as they go.
  await areas.getByRole("button", { name: "Colour for Home: None" }).click();
  const home = page.getByRole("group", { name: "Colour for Home" });
  await home.getByRole("radio", { name: "None" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(home.getByRole("radio", { name: "Moss" })).toBeChecked();
  await expect(areas.getByRole("button", { name: "Colour for Home: Moss" })).toBeVisible();
}

signedIn.describe("area colours", () => {
  signedIn.describe.configure({ mode: "serial" });
  signedIn.use({ timezoneId: "UTC" });

  signedIn.beforeEach(async ({ context, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await context.addCookies([{ name: "axiis-e2e-account", value: "areas", url: baseURL }]);
  });

  signedIn("start as None, so nothing is coloured until one is chosen", async ({ page }) => {
    await page.goto(DAY);
    await expect(staffLabel(page, "Work")).toBeVisible();
    await expect(dot(page.locator("body"))).toHaveCount(0);
  });

  signedIn("are chosen in Settings, kept, and shown on the Score, Week, Month, detail panel and rail", async ({ page }) => {
    await colourWorkAndHome(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Colour for Work: Clay" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Colour for Home: Moss" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Colour for Health: None" })).toBeVisible();

    await page.goto(DAY);
    await expect(dot(staffLabel(page, "Work"))).toHaveAttribute("data-area-color", "clay");
    await expect(dot(staffLabel(page, "Home"))).toHaveAttribute("data-area-color", "moss");
    await expect(dot(staffLabel(page, "Health"))).toHaveCount(0);
    expect(await fill(staffLabel(page, "Work"))).toBe(CLAY.light);
    const readout = page.getByRole("region", { name: "Open today, by area" });
    await expect(dot(readout)).toHaveCount(2);
    await expect(readout.getByRole("listitem").filter({ hasText: "Work" }).locator("[data-area-color]")).toHaveAttribute("data-area-color", "clay");
    const budget = page.locator(`[data-item="${BUDGET}"]`);
    await expect(dot(budget)).toHaveAttribute("data-area-color", "clay");
    await expect(dot(page.getByRole("button", { name: /^Water the ferns, any time, Home/ }))).toHaveAttribute("data-area-color", "moss");
    await expect(dot(page.getByRole("button", { name: /^Sort the receipts, waiting, Work/ }))).toHaveAttribute("data-area-color", "clay");

    await budget.click();
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByLabel("Area")).toHaveValue(/.+/);
    await expect(dot(details)).toHaveAttribute("data-area-color", "clay");

    await page.goto("/week/2099-05-18");
    await expect(dot(page.getByRole("button", { name: /^Draft the budget, 10:00 to 11:30, Work/ }))).toHaveAttribute("data-area-color", "clay");
    await expect(dot(page.getByRole("button", { name: /^Water the ferns, Any time, Home/ }))).toHaveAttribute("data-area-color", "moss");

    await page.goto("/month/2099-05");
    const wednesday = page.getByRole("gridcell", { name: /^Wednesday 20 May/ });
    await expect(dot(wednesday.getByRole("button", { name: /^Draft the budget/ }))).toHaveAttribute("data-area-color", "clay");
    await expect(dot(wednesday.getByRole("button", { name: /^Water the ferns/ }))).toHaveAttribute("data-area-color", "moss");
  });

  signedIn("are a dot, never the only sign: each coloured mark sits beside its area's name or in a mark named for it", async ({ page }) => {
    await colourWorkAndHome(page);
    await page.goto(DAY);
    for (const name of ["Work", "Home"]) await expect(staffLabel(page, name)).toContainText(name);
    await expect(page.locator("[data-area-color]:not([aria-hidden='true'])")).toHaveCount(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    signedIn.describe(`in ${colorScheme}`, () => {
      signedIn.use({ colorScheme });

      signedIn("take the theme's token and pass axe on Settings with the picker open and on the Score", async ({ page }) => {
        await colourWorkAndHome(page);
        expect(await axe(page)).toEqual([]);
        await page.goto(DAY);
        expect(await fill(staffLabel(page, "Work"))).toBe(CLAY[colorScheme]);
        expect(await fill(staffLabel(page, "Home"))).toBe(MOSS[colorScheme]);
        expect(await axe(page)).toEqual([]);
      });
    });
  }

  signedIn.describe("at 375", () => {
    signedIn.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    signedIn("give each swatch a 44px target and keep the page from scrolling sideways", async ({ page }) => {
      await page.goto("/settings");
      await page.getByRole("button", { name: "Colour for Work: None" }).click();
      const swatches = page.getByRole("group", { name: "Colour for Work" }).locator("label");
      await expect(swatches).toHaveCount(9);
      for (const box of await swatches.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole("group", { name: "Colour for Work" }).getByRole("radio", { name: "Plum" }).check();
      await expect(page.getByRole("button", { name: "Colour for Work: Plum" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await axe(page)).toEqual([]);
      await page.goto("/month/2099-05");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
});
