import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hydrated, signedIn } from "./session";

// "Plan your day" on an empty today with the Inbox waiting (`axiis-e2e-account=areas`, read only here): beside the grid
// in the side column when the page has room for one, and one line above the grid, closed, when it has not.

test.describe("Plan your day", () => {
  signedIn.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "axiis-e2e-account", value: "areas", url: baseURL! }]);
  });

  signedIn("narrow: one line above the grid, closed, and the grid stays the first thing under the header", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto("/today");
    await hydrated(page);
    const strip = page.getByRole("region", { name: "Plan your day" });
    const show = strip.getByRole("button", { name: "Show the Inbox items" });
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(strip.getByRole("button", { name: /^Plan for today/ })).toHaveCount(0);
    await expect(strip).toContainText("in the Inbox");
    const grid = page.locator("[data-calendar-grid]");
    const box = await strip.boundingBox();
    expect(box!.height).toBeLessThan(64);
    await show.click();
    await expect(page.getByRole("button", { name: "Hide the Inbox items" })).toHaveAttribute("aria-expanded", "true");
    await expect(strip.getByRole("button", { name: /^Plan for today/ }).first()).toBeVisible();
    await expect(grid).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });

  signedIn("wide: the full card sits beside the grid, with no Show button", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/today");
    await hydrated(page);
    const strip = page.getByRole("region", { name: "Plan your day" });
    await expect(strip.getByRole("button", { name: /the Inbox items$/ })).toBeHidden();
    await expect(strip.getByRole("button", { name: /^Plan for today/ }).first()).toBeVisible();
    const s = (await strip.boundingBox())!;
    const g = (await page.locator("[data-calendar-grid]").boundingBox())!;
    expect(s.x).toBeGreaterThanOrEqual(g.x + g.width - 1);
  });
});
