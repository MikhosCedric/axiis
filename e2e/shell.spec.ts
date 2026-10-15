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

test.describe("the rail", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("groups its places under Plan, Capture and Library, each with a hint, and heads Areas as a readout", async ({ page }) => {
    await page.goto("/dev/palette");
    const rail = page.getByRole("navigation", { name: "Primary" });
    await expect(rail.getByRole("heading")).toHaveText(["Plan", "Capture", "Library", "Open today, by area"]);
    await expect(rail.getByRole("list", { name: "Plan" }).getByRole("link")).toHaveText(["Today", "Week", "Month", "Due"]);
    await expect(rail.getByRole("list", { name: "Capture" }).getByRole("link")).toHaveText(["Inbox"]);
    await expect(rail.getByRole("list", { name: "Library" }).getByRole("link")).toHaveText(["Lists", "Notes", "Tags"]);
    await expect(rail.getByRole("link", { name: "Inbox" })).toHaveAttribute("title", "Waiting for a day");
    await expect(rail.getByRole("link", { name: "Month" })).toHaveAttribute("title", "The whole month at a glance");
    await expect(rail.getByRole("region", { name: "Open today, by area" }).getByRole("link")).toHaveCount(0);
    await expect(rail.getByRole("link", { name: "Search" })).toHaveCount(0);
  });

  test("one search field at the top opens the palette", async ({ page }) => {
    await page.goto("/dev/palette");
    await page.locator("[data-hydrated]").waitFor({ state: "attached" });
    const field = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /^Search or go to/ });
    await expect(field).toHaveCount(1);
    await field.click();
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole("option", { name: "Search, Find any task or note" })).toBeVisible();
  });

  test("the account row opens a menu that Escape closes, handing focus back", async ({ page }) => {
    await page.goto("/dev/palette");
    await page.locator("[data-hydrated]").waitFor({ state: "attached" });
    const account = page.getByRole("button", { name: "Account" });
    const menu = page.getByRole("group", { name: "Account" });
    await expect(menu).toBeHidden();
    await expect(account).toHaveAttribute("aria-expanded", "false");

    await account.click();
    await expect(menu).toBeVisible();
    await expect(account).toHaveAttribute("aria-expanded", "true");
    const settings = menu.getByRole("link", { name: "Settings" });
    await expect(settings).toBeFocused();
    await expect(settings).toHaveAttribute("href", "/settings");
    await expect(menu.getByRole("button", { name: "Switch between light and dark" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(menu.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    const signOut = menu.locator("form").filter({ has: page.getByRole("button", { name: "Sign out" }) });
    await expect(signOut).toHaveAttribute("method", "post");
    await expect(signOut).toHaveAttribute("action", "/auth/signout");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    await page.keyboard.press("Tab");
    await expect(menu.getByRole("button", { name: "Switch between light and dark" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();
    await expect(account).toHaveAttribute("aria-expanded", "false");
  });

  test("a click outside the account menu closes it", async ({ page }) => {
    await page.goto("/dev/palette");
    await page.locator("[data-hydrated]").waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Account" }).click();
    const menu = page.getByRole("group", { name: "Account" });
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(menu).toBeHidden();
  });
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
    await expect(bar).toHaveText(["Today", "Week", "Due", "Inbox", "More"]);
    const box = (await nav.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(812, 0);

    const more = nav.getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("heading")).toHaveText(["Plan", "Library", "Account"]);
    await expect(sheet.getByRole("list", { name: "Plan" }).getByRole("link")).toHaveText([/^Month/]);
    await expect(sheet.getByRole("link", { name: "Month", exact: true })).toHaveAccessibleDescription("The whole month at a glance");
    await expect(sheet.getByRole("list", { name: "Library" }).getByRole("link")).toHaveText([/^Lists/, /^Notes/, /^Tags/]);
    await expect(sheet.getByRole("link", { name: "Lists", exact: true })).toHaveAccessibleDescription("Checklists");
    await expect(sheet.getByRole("list", { name: "Account" }).getByRole("listitem")).toHaveText([/Theme/, /^Settings/, /Sign out/]);
    for (const control of [
      sheet.getByRole("link", { name: "Search", exact: true }),
      sheet.getByRole("link", { name: "Month", exact: true }),
      sheet.getByRole("link", { name: "Lists", exact: true }),
      sheet.getByRole("link", { name: "Notes", exact: true }),
      sheet.getByRole("link", { name: "Tags", exact: true }),
      sheet.getByRole("link", { name: "Settings", exact: true }),
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
