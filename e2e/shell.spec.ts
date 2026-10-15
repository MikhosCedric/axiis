import AxeBuilder from "@axe-core/playwright";
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

test("the week's date field shows the focus ring", async ({ page }) => {
  await page.goto("/dev/week");
  const picker = page.getByLabel("Go to the week of a date");
  await picker.focus();
  await expect(picker).toHaveCSS("outline-style", "solid");
  await expect(picker).toHaveCSS("outline-width", "2px");
});

test("the Tags index starts at the same left edge as Lists", async ({ page }) => {
  const left = async (path: string) => {
    await page.goto(path);
    return (await page.getByRole("heading", { level: 1 }).boundingBox())!.x;
  };
  expect(await left("/dev/tags")).toBe(await left("/dev/lists"));
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

  test("the view switches and the site's header and footer links are a thumb wide", async ({ page }) => {
    const atLeastThumb = async (controls: import("@playwright/test").Locator) => {
      for (const control of await controls.all()) {
        const box = await control.boundingBox();
        expect(box!.height, await control.innerText()).toBeGreaterThanOrEqual(44);
      }
    };
    await page.goto("/dev/score");
    await atLeastThumb(page.getByRole("group", { name: "View" }).getByRole("button"));
    await atLeastThumb(page.getByRole("group", { name: "Day or week" }).getByRole("link"));
    await page.goto("/");
    await atLeastThumb(page.getByRole("banner").getByRole("link", { name: "Sign in" }));
    await atLeastThumb(page.getByRole("navigation", { name: "Site" }).getByRole("link"));
  });

  test("the bottom bar holds four places and More, which opens the rest a thumb wide", async ({ page }) => {
    await page.goto("/dev/palette");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const bar = nav.getByRole("listitem");
    await expect(bar).toHaveText(["Today", "Week", "Inbox", "Due", "More"]);
    const box = (await nav.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(812, 0);

    const more = nav.getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    for (const control of [
      sheet.getByRole("link", { name: "Lists" }),
      sheet.getByRole("link", { name: "Notes" }),
      sheet.getByRole("link", { name: "Tags" }),
      sheet.getByRole("link", { name: "Search" }),
      sheet.getByRole("link", { name: "Settings" }),
      sheet.getByRole("button", { name: "Sign out" }),
    ]) {
      await expect(control).toBeInViewport({ ratio: 1 });
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
  });
});
