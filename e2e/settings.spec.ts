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
    await expect(tags.getByText("No tags yet.")).toBeVisible();
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
    expect(await axe(page)).toEqual([]);
  });
});
