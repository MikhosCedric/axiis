import { expect, test } from "@playwright/test";

test("the Score and Week trays are the Inbox's waiting pile and say so", async ({ page }) => {
  for (const path of ["/dev/score", "/dev/week"]) {
    await page.goto(path);
    const tray = page.getByRole("region", { name: "Waiting", exact: true });
    await expect(tray).toContainText("No day yet.");
    await expect(tray.getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/inbox");
  }
  await page.goto("/dev/inbox");
  await expect(page.getByRole("region", { name: "Waiting", exact: true })).toBeVisible();
});

test.describe("shell on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the page is no wider than the screen (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/dev/palette");
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
    });
  }

  test("settings and sign out are on screen without scrolling the bar", async ({ page }) => {
    await page.goto("/dev/palette");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const control of [nav.getByRole("link", { name: "Settings" }), nav.getByRole("button", { name: "Sign out" })]) {
      await expect(control).toBeInViewport({ ratio: 1 });
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});
