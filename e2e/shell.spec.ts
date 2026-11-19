import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hydrated, signedIn } from "./session";

test("the Day and Week trays are the Inbox and link to it", async ({ page }) => {
  for (const path of ["/dev/day", "/dev/calendar"]) {
    await page.goto(path);
    const tray = page.getByRole("region", { name: "Inbox", exact: true });
    await expect(tray).toHaveAccessibleDescription(/^No day yet\./);
    await expect(tray.getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/inbox");
  }
  await page.goto("/dev/inbox");
  await expect(page.getByRole("region", { name: "Items with no day", exact: true })).toBeVisible();
  await expect(page.locator(".page-summary")).toHaveText(/^\d+ to plan$/);
});

signedIn("the date jump's typed date field shows the focus ring", async ({ page }) => {
  await page.goto("/week");
  await hydrated(page);
  await page.getByRole("heading", { level: 1 }).getByRole("button").click();
  const picker = page.getByLabel("Go to date");
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

  test("holds Create, a small month, the areas as ticks, then Calendar, Tasks and Library, each place with a hint", async ({ page }) => {
    await page.goto("/dev/palette");
    await hydrated(page);
    const rail = page.getByRole("navigation", { name: "Primary" });
    await expect(rail.getByRole("heading")).toHaveText(["Areas", "Calendar", "Tasks", "Library"]);
    await expect(rail.getByRole("list", { name: "Calendar" }).getByRole("link")).toHaveText(["Day", "Week", "Month"]);
    await expect(rail.getByRole("list", { name: "Tasks" }).getByRole("link")).toHaveText([/^Inbox/, /^Due/, "Done"]);
    await expect(rail.getByRole("list", { name: "Library" }).getByRole("link")).toHaveText(["Lists", "Notes", "Tags"]);
    await expect(rail.getByRole("link", { name: "Inbox" })).toHaveAttribute("title", "Captured, with no day yet");
    await expect(rail.getByRole("link", { name: "Month", exact: true })).toHaveAttribute("title", "The whole month at a glance ( M )");
    const areas = rail.getByRole("region", { name: "Areas" }).getByRole("checkbox");
    await expect(areas).toHaveCount(3);
    for (const name of ["Work", "Home", "Health"]) await expect(rail.getByRole("checkbox", { name: new RegExp(`^${name}`) })).toBeChecked();
    await expect(rail.getByRole("link", { name: "Search" })).toHaveCount(0);

    // Create comes first and shows its key; like C, it goes to the page's capture field (the palette captures where a page has none).
    const create = rail.getByRole("button", { name: /^Create/ });
    await expect(create).toHaveAttribute("aria-keyshortcuts", "c");
    await create.click();
    await expect(page.locator("#capture")).toBeFocused();

    // The small month: this month, today marked, one day in the Tab order, arrows move by a day and a week.
    const month = rail.getByRole("group", { name: /^[A-Z][a-z]+ \d{4}$/ });
    await expect(month.getByRole("link", { name: /, today/ })).toHaveAttribute("aria-current", "date");
    await expect(month.locator('a[tabindex="0"]')).toHaveCount(1);
    await month.locator('a[tabindex="0"]').focus();
    const from = await month.locator('a[tabindex="0"]').getAttribute("data-date");
    await page.keyboard.press("ArrowDown");
    const to = await page.evaluate(() => document.activeElement?.getAttribute("data-date"));
    expect((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000).toBe(7);
  });

  test("one search field at the top opens the palette", async ({ page }) => {
    await page.goto("/dev/palette");
    await hydrated(page);
    const field = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /^Search or go to/ });
    await expect(field).toHaveCount(1);
    await field.click();
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole("option", { name: "Search", exact: true })).toBeVisible();
  });

  test("the account row opens a menu that Escape closes, handing focus back", async ({ page }) => {
    await page.goto("/dev/palette");
    await hydrated(page);
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
    await hydrated(page);
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
    await page.goto("/dev/day");
    await atLeastThumb(page.getByRole("group", { name: "View" }).getByRole("button"));
    await page.goto("/");
    await atLeastThumb(page.getByRole("banner").getByRole("link", { name: "Sign in" }));
    await atLeastThumb(page.getByRole("navigation", { name: "Site" }).getByRole("link"));
  });

  test("the bottom bar holds four places and More, which opens the rest a thumb wide", async ({ page }) => {
    await page.goto("/dev/palette");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const bar = nav.getByRole("listitem");
    await expect(bar).toHaveText(["Day", "Week", "Inbox", "Due", "More"]);
    const box = (await nav.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(812, 0);

    const more = nav.getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("heading")).toHaveText(["Areas", "Calendar", "Tasks", "Library", "Account"]);
    await expect(sheet.getByRole("list", { name: "Calendar" }).getByRole("link")).toHaveText([/^Month/]);
    await expect(sheet.getByRole("list", { name: "Tasks" }).getByRole("link")).toHaveText([/^Done/]);
    await expect(sheet.getByRole("checkbox")).toHaveCount(3);
    await expect(sheet.getByRole("link", { name: /, today/ })).toHaveAttribute("aria-current", "date");
    await expect(sheet.getByRole("link", { name: /^Month/ })).toHaveAccessibleName("Month The whole month at a glance");
    await expect(sheet.getByRole("list", { name: "Library" }).getByRole("link")).toHaveText([/^Lists/, /^Notes/, /^Tags/]);
    await expect(sheet.getByRole("link", { name: /^Lists/ })).toHaveAccessibleName("Lists Checklists and how far along each is");
    await expect(sheet.getByRole("list", { name: "Account" }).getByRole("listitem")).toHaveText([/Theme/, /^Settings/, /Sign out/]);
    for (const control of [
      sheet.getByRole("link", { name: /^Search/ }),
      sheet.getByRole("link", { name: /^Month/ }),
      sheet.getByRole("link", { name: /^Lists/ }),
      sheet.getByRole("link", { name: /^Notes/ }),
      sheet.getByRole("link", { name: /^Tags/ }),
      sheet.getByRole("link", { name: /^Settings/ }),
      sheet.getByRole("button", { name: "Sign out" }),
    ]) {
      // With the areas above it, Account can sit just past the fold on a short phone; the sheet scrolls to it.
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 0.99 });
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
  });
});
