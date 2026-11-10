import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// Settings changes reach every page at once, on the in-memory account kept for these tests
// (`axiis-e2e-account=settings`, the fixtures with #errands on "Renew passport").

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=settings` } });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

const recent = (page: Page) => page.evaluate(() => window.localStorage.getItem("axiis-recent") ?? "[]");

signedIn.describe("settings", () => {
  signedIn.describe.configure({ mode: "serial" });

  signedIn.beforeEach(async ({ context, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await context.addCookies([{ name: "axiis-e2e-account", value: "settings", url: baseURL }]);
  });

  signedIn("deleting a tag takes it off every page, out of Recent, and its page says it is gone", async ({ page }) => {
    // Visit the tag's page so the palette remembers it, then the Inbox, where the item wears it.
    await page.goto("/tags/errands");
    await hydrated(page);
    await expect.poll(() => recent(page)).toContain("/tags/errands");
    await page.goto("/inbox");
    await expect(page.getByRole("main").getByText("#errands")).toBeVisible();
    await hydrated(page);

    await page.keyboard.press("g");
    await page.keyboard.press(",");
    await expect(page).toHaveURL(/\/settings$/);
    await hydrated(page);
    const tags = page.getByRole("region", { name: "Tags" });
    await tags.getByRole("button", { name: "Delete #errands" }).click();
    await tags.getByRole("group", { name: "Delete #errands? It comes off 1 open item. The items stay." }).getByRole("button", { name: "Yes" }).click();
    await expect(tags.getByRole("textbox", { name: "Rename #errands" })).toHaveCount(0);
    await expect.poll(() => recent(page)).not.toContain("/tags/errands");

    // Back to the Inbox the way people go back: the item is there, the tag is not.
    await page.goBack();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.getByRole("main").getByText("Renew passport")).toBeVisible();
    await expect(page.getByRole("main").getByText("#errands")).toHaveCount(0);

    await page.goto("/tags/errands");
    await expect(page.getByRole("heading", { level: 1, name: "No such tag" })).toBeVisible();
    await expect(page.getByRole("link", { name: "All tags" })).toBeVisible();
    // A missing page is not kept in Recent either.
    await page.waitForTimeout(600);
    expect(await recent(page)).not.toContain("/tags/errands");
  });

  signedIn("renaming a tag moves Recent to its new page", async ({ page }) => {
    await page.goto("/tags/errands");
    await hydrated(page);
    await expect.poll(() => recent(page)).toContain("/tags/errands");
    await page.goto("/settings");
    await hydrated(page);
    const name = page.getByRole("textbox", { name: "Rename #errands" });
    await name.fill("chores");
    await name.press("Enter");
    await expect.poll(() => recent(page)).toContain("/tags/chores");
    expect(await recent(page)).not.toContain("/tags/errands");
    await page.goto("/inbox");
    await expect(page.getByRole("main").getByText("#chores")).toBeVisible();
  });

  signedIn("a removed area comes back with Undo, in its place", async ({ page }) => {
    await page.goto("/settings");
    await hydrated(page);
    const areas = page.getByRole("region", { name: "Areas" });
    const names = () => areas.getByRole("textbox", { name: /^Rename / }).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    await expect.poll(names).toEqual(["Work", "Home", "Health"]);

    await areas.getByRole("button", { name: "Remove Home" }).click();
    await areas.getByRole("group", { name: "Remove Home? Its items stay, under No area." }).getByRole("button", { name: "Yes" }).click();
    await expect(areas.getByRole("status")).toContainText("Removed Home.");
    await expect.poll(names).toEqual(["Work", "Health"]);
    await expect(page.getByRole("navigation", { name: "Primary" }).first().getByRole("link", { name: /^Home\b/ })).toHaveCount(0);

    await areas.getByRole("button", { name: "Undo" }).click();
    await expect.poll(names).toEqual(["Work", "Home", "Health"]);
  });

  signedIn("sections are listed beside the page, and the desktop section shows only in the app", async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/settings");
    const index = page.getByRole("navigation", { name: "Settings sections" });
    await expect(index.getByRole("link")).toHaveText(["Areas", "Tags", "Display", "Keyboard", "Your data"]);
    await expect(page.getByRole("heading", { name: "Keyboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desktop app" })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);

    await context.addCookies([{ name: "axiis_desktop", value: "1", url: baseURL }]);
    await page.reload();
    await hydrated(page);
    await expect(index.getByRole("link")).toHaveText(["Areas", "Tags", "Display", "Keyboard", "Desktop app", "Your data"]);
    await page.getByRole("group", { name: "Reminders" }).getByRole("button", { name: "Off" }).click();
    await expect(page.getByText("Reminders are off.")).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "reminders")?.value).toBe("off");
    // The refresh after the choice streams the title back in; axe reads the page once it is there.
    await expect(page).toHaveTitle(/Settings/);
    expect(await axe(page)).toEqual([]);
  });

  signedIn("merging a tag says what changes, moves its items, and a page filtered by it says it is gone", async ({ page }) => {
    await page.goto("/tags/errands");
    await hydrated(page);
    await expect.poll(() => recent(page)).toContain("/tags/errands");
    await page.goto("/settings");
    await hydrated(page);
    const tags = page.getByRole("region", { name: "Tags" });
    await tags.getByRole("button", { name: "Merge #errands into another tag" }).click();
    const panel = tags.getByRole("group", { name: "Merge #errands" });
    await expect(panel.getByRole("combobox", { name: "Merge #errands into" })).toHaveValue(/.+/);
    await panel.getByRole("button", { name: "Continue" }).click();
    await expect(panel).toContainText("One item wears #errands, including any in Recently deleted. It will wear #travel instead.");
    await expect(panel).toContainText("This cannot be undone.");
    // Focus waits on the way out, so a stray Enter keeps both.
    await expect(panel.getByRole("button", { name: "Keep both" })).toBeFocused();
    expect(await axe(page)).toEqual([]);
    await panel.getByRole("button", { name: "Merge into #travel" }).click();
    await expect(tags.getByRole("textbox", { name: "Rename #errands" })).toHaveCount(0);
    await expect(tags.getByRole("link", { name: "2 open with #travel" })).toBeVisible();
    await expect.poll(() => recent(page)).toContain("/tags/travel");
    expect(await recent(page)).not.toContain("/tags/errands");

    await page.goto("/inbox");
    await expect(page.getByRole("main").getByText("#travel").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("#errands")).toHaveCount(0);

    for (const path of ["/inbox", "/today", "/week"]) {
      await page.goto(`${path}?tag=errands`);
      const gone = page.locator("[data-tag-gone]");
      await expect(gone, path).toContainText("There is no tag #errands any more");
      await gone.getByRole("link", { name: "Show everything" }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });

  signedIn("the week can start on Sunday and Axiis can open on another page", async ({ page, context, baseURL }) => {
    await page.goto("/settings");
    await hydrated(page);
    await page.getByRole("group", { name: "Week starts on" }).getByRole("button", { name: "Sunday" }).click();
    await expect(page.getByText("First day of the week saved on this device.")).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "week-start")?.value).toBe("sunday");
    await page.getByRole("combobox", { name: "Start page" }).selectOption("inbox");
    await expect(page.getByText("Start page saved on this device.")).toBeVisible();

    await page.goto("/week/2026-10-07");
    const headings = page.getByRole("main").getByRole("heading", { level: 1 });
    await expect(headings).toContainText("4 to 10 October");
    await page.goto("/month/2026-10");
    await expect(page.getByRole("columnheader").first()).toHaveAccessibleName(/Sunday/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/inbox$/);
    await context.addCookies([{ name: "week-start", value: "monday", url: baseURL }]);
    await page.goto("/week/2026-10-07");
    await expect(headings).toContainText("5 to 11 October");
  });

  signedIn("the Keyboard section is left out on a touch screen", async ({ browser, baseURL }) => {
    const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
    await touch.addCookies([
      { name: SESSION_COOKIE, value: sessionSecret(), url: baseURL },
      { name: "axiis-e2e-account", value: "settings", url: baseURL },
    ]);
    const phone = await touch.newPage();
    await phone.goto("/settings");
    await expect(phone.getByRole("heading", { name: "Display" })).toBeVisible();
    await expect(phone.getByRole("heading", { name: "Keyboard" })).toBeHidden();
    await expect(phone.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Keyboard" })).toBeHidden();
    await touch.close();
  });
});
