import { expect, test, type Page } from "@playwright/test";
import { hydrated, signedIn } from "./session";

// The motion system (DESIGN.md, Motion). The rest of the suite runs with reduced motion so nothing races an
// animation (playwright.config.ts); these specs turn motion on and check the key transitions run and settle,
// and that reduced motion draws no movement at all.

const WEEK = "/dev/calendar?date=2026-03-11&tz=UTC";
const PANEL = "/dev/lists?item=f3000000-0000-4000-8000-000000000001";
const THURSDAY = '[data-day-col="2026-03-12"] [data-item]';

/** Plans the first Inbox chip onto Thursday by a pointer drag, and returns how many items Thursday held before. */
async function planFromTray(page: Page) {
  await page.goto(WEEK);
  await hydrated(page);
  await expect(page.locator("[data-calendar-grid]")).toBeVisible();
  const chip = page.locator('[data-drop="tray"] button[data-nav]').first();
  await expect(chip).toBeVisible();
  const had = await page.locator(THURSDAY).count();
  const a = (await chip.boundingBox())!;
  const col = (await page.locator('[data-day-col="2026-03-12"]').boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(col.x + col.width / 2, 430, { steps: 12 });
  await page.mouse.up();
  return had;
}

const copies = (page: Page) => page.locator("[data-item-copy]").count();
const columnAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).hasAttribute("data-day-col")).length);

test.describe("with motion on", () => {
  test.use({ reducedMotion: "no-preference" });

  test("an Inbox item travels to its block over the page, then the page is still", async ({ page }) => {
    const had = await planFromTray(page);
    await expect.poll(() => copies(page), { timeout: 2000 }).toBeGreaterThan(0);
    await expect.poll(() => copies(page), { timeout: 3000 }).toBe(0);
    await expect(page.locator(THURSDAY)).toHaveCount(had + 1);
  });

  test("the detail panel arrives by moving in, and settles in place", async ({ page }) => {
    await page.goto(PANEL);
    await hydrated(page);
    const panel = page.getByRole("complementary", { name: "Details" });
    await expect(panel).toBeVisible();
    await expect.poll(() => panel.evaluate((el) => getComputedStyle(el).transform), { timeout: 3000 }).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });
});

signedIn.describe("stepping with motion on", () => {
  signedIn.use({ reducedMotion: "no-preference" });

  signedIn("to the next week slides the columns, and they settle", async ({ page }) => {
    // The slide is short, so count the moments a column is given one rather than hoping to catch it playing.
    await page.addInitScript(() => {
      const w = window as unknown as { slides: number };
      w.slides = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
        if (this.hasAttribute("data-day-col")) w.slides++;
        return animate.apply(this, args);
      };
    });
    await page.goto("/week");
    await hydrated(page);
    await expect(page.locator("[data-day-col]").first()).toBeVisible();
    await page.getByTitle(/^Next week/).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { slides: number }).slides), { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(() => columnAnimations(page), { timeout: 3000 }).toBe(0);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("planning from the Inbox draws no look-alike and moves nothing", async ({ page }) => {
    const had = await planFromTray(page);
    for (let i = 0; i < 6; i++) {
      expect(await copies(page)).toBe(0);
      await page.waitForTimeout(80);
    }
    await expect(page.locator(THURSDAY)).toHaveCount(had + 1);
    const moving = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some((k) => k.transform && k.transform !== "none")).length,
    );
    expect(moving).toBe(0);
  });

  test("the detail panel has no movement", async ({ page }) => {
    await page.goto(PANEL);
    await hydrated(page);
    const panel = page.getByRole("complementary", { name: "Details" });
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((el) => el.getAnimations().length)).toBe(0);
  });
});
