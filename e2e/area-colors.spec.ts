import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// Area colours on the real signed-in routes, as the in-memory account whose items sit in areas
// (`axiis-e2e-account=areas`, src/lib/supabase/fake-account.ts): "Draft the budget" in Work at 10:00 on
// 20 May 2099, "Water the ferns" in Home on that day at any time, "Sort the receipts" in Work with no day.

const DAY = "/day/2099-05-20";
const BUDGET = "e2e00000-0000-4000-8000-000000000021";

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=areas` } });

// A colour save refreshes the page, and for a moment the refresh leaves it without a title; axe reads that as a fault.
async function axe(page: Page) {
  await expect(page).toHaveTitle(/./);
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

const dot = (scope: Locator) => scope.locator("[data-area-color]");
/** A block or chip on the grid by its title; it carries its area's colour as an inline --tint. */
const tile = (page: Page, title: string) => page.locator("[data-calendar-grid] [data-item], [data-drop=tray] [data-item]").filter({ hasText: title });
const tintedAs = (scope: Locator, color: string) => expect(scope).toHaveAttribute("style", new RegExp(`--tint: ?var\\(--area-${color}\\)`));

/** Opens an area's picker, once the page answers clicks. */
async function openPicker(page: Page, area: string) {
  const group = page.getByRole("group", { name: `Colour for ${area}` });
  await hydrated(page);
  await page.getByRole("button", { name: new RegExp(`^Colour for ${area}: `) }).click();
  await expect(group).toBeVisible();
  return group;
}

async function colourWorkAndHome(page: Page) {
  await page.goto("/settings");
  const areas = page.getByRole("region", { name: "Areas" });
  await expect(areas.getByRole("button", { name: "Colour for Work: None" })).toBeVisible();
  const work = await openPicker(page, "Work");
  await expect(work.getByRole("radio")).toHaveCount(13);
  await expect(work.getByRole("radio", { name: "None" })).toBeChecked();
  await work.getByRole("radio", { name: "Clay" }).check();
  await expect(areas.getByRole("button", { name: "Colour for Work: Clay" })).toBeVisible();

  // Keyboard: arrows walk the native radio group from None through Clay, Terracotta, Ochre and Mustard to Moss, choosing as they go.
  await areas.getByRole("button", { name: "Colour for Home: None" }).click();
  const home = page.getByRole("group", { name: "Colour for Home" });
  await home.getByRole("radio", { name: "None" }).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
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
    await expect(tile(page, "Draft the budget")).toBeVisible();
    await expect(page.locator("[data-calendar-grid] [style*='--tint']")).toHaveCount(0);
    await expect(dot(page.locator("body"))).toHaveCount(0);
  });

  signedIn("are chosen in Settings, kept, and shown on the Day, Week, Month, detail panel and rail", async ({ page }) => {
    await colourWorkAndHome(page);
    // The arrows sent one save per colour they passed and the button shows the last at once, so a reload can land
    // before the last save does; kept means it reads Moss once the saves are in.
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("button", { name: "Colour for Home: Moss" })).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page.getByRole("button", { name: "Colour for Work: Clay" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Colour for Health: None" })).toBeVisible();

    await page.goto(DAY);
    await tintedAs(tile(page, "Draft the budget"), "clay");
    await tintedAs(tile(page, "Water the ferns"), "moss");
    const readout = page.getByRole("region", { name: "Areas" });
    await expect(dot(readout)).toHaveCount(2);
    await expect(readout.getByRole("listitem").filter({ hasText: "Work" }).locator("[data-area-color]")).toHaveAttribute("data-area-color", "clay");
    const budget = page.locator(`[data-item="${BUDGET}"]`);
    await tintedAs(budget, "clay");
    await tintedAs(tile(page, "Sort the receipts"), "clay");

    await budget.getByRole("button").first().focus();
    await page.keyboard.press("Enter");
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByLabel("Area")).toHaveValue(/.+/);
    await expect(dot(details)).toHaveAttribute("data-area-color", "clay");

    await page.goto("/week/2099-05-18");
    await tintedAs(tile(page, "Draft the budget"), "clay");
    await tintedAs(tile(page, "Water the ferns"), "moss");

    await page.goto("/month/2099-05");
    const wednesday = page.getByRole("gridcell", { name: /^Wednesday 20 May/ });
    await expect(dot(wednesday.getByRole("button", { name: /^10:00, Draft the budget/ }))).toHaveAttribute("data-area-color", "clay");
    await expect(dot(wednesday.getByRole("button", { name: /^Water the ferns/ }))).toHaveAttribute("data-area-color", "moss");
  });

  signedIn("are a dot, never the only sign: each coloured mark sits beside its area's name or in a mark named for it", async ({ page }) => {
    await colourWorkAndHome(page);
    await page.goto(DAY);
    for (const [title, area] of [["Draft the budget", "Work"], ["Water the ferns", "Home"]]) {
      await expect(page.locator("[data-calendar-grid]").getByRole("button", { name: new RegExp(`^${title}.*, ${area}, `) })).toBeVisible();
    }
    await expect(page.locator("[data-area-color]:not([aria-hidden='true'])")).toHaveCount(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    signedIn.describe(`in ${colorScheme}`, () => {
      signedIn.use({ colorScheme });

      signedIn("take the theme's token and pass axe on Settings with the picker open and on the Day", async ({ page }) => {
        await colourWorkAndHome(page);
        expect(await axe(page)).toEqual([]);
        await page.goto(DAY);
        await tintedAs(tile(page, "Draft the budget"), "clay");
        await tintedAs(tile(page, "Water the ferns"), "moss");
        expect(await axe(page)).toEqual([]);
      });
    });
  }

  signedIn.describe("at 375", () => {
    signedIn.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    signedIn("give each swatch a 44px target and keep the page from scrolling sideways", async ({ page }) => {
      await page.goto("/settings");
      const swatches = (await openPicker(page, "Work")).locator("label");
      await expect(swatches).toHaveCount(13);
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
