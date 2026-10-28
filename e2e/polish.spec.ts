import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// A busy week of its own, so these resets never meet another spec's account.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=polish` } });

signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([
    { name: "axiis-e2e-account", value: "polish", url: baseURL },
    { name: "tour", value: "done", url: baseURL },
  ]);
});

const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

signedIn.describe("surfaces", () => {
  signedIn("Next up and the List sit on raised cards over the paper", async ({ page }) => {
    await page.goto("/today?view=list");
    await hydrated(page);
    const card = page.getByRole("region", { name: "Next up" }).getByRole("list");
    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toMatch(/inset/);
    expect(await card.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("12px");
  });

  signedIn("on a phone the header and the tab bar stay put, blurring the page behind them", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/today?view=list");
    await hydrated(page);
    expect(await style(page, "header.glass", "position")).toBe("sticky");
    expect(await style(page, "header.glass", "backdrop-filter")).toMatch(/blur\(14px\)/);
    expect(await style(page, "nav.glass-rail", "backdrop-filter")).toMatch(/blur\(14px\)/);
    await page.mouse.wheel(0, 600);
    await expect(page.locator("header.glass")).toBeInViewport();
  });
});

signedIn.describe("no axe violations on the polished surfaces", () => {
  for (const { width, colorScheme } of [
    { width: 1440, colorScheme: "light" as const },
    { width: 1440, colorScheme: "dark" as const },
    { width: 375, colorScheme: "dark" as const },
    { width: 375, colorScheme: "light" as const },
  ]) {
    signedIn(`Today's List and the Week at ${width} in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const path of ["/today?view=list", "/week"]) {
        await page.goto(path);
        await hydrated(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
    });
  }
});
