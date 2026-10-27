import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The busy account seeds its week around the server's real today in the server's own zone; the browser takes that zone too.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=gestures` } });

// One in-memory account is shared by every worker, and these tests change it, so they run one at a time.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([{ name: "axiis-e2e-account", value: "gestures", url: baseURL }]);
});

/** Today's List; Next up above it can hold the same items, depending on the hour. */
const list = (page: Page) => page.getByRole("region", { name: "List", exact: true });
const title = (page: Page, name: string) => list(page).getByRole("button", { name: new RegExp(`^${name}`) });
const note = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).last();

async function openList(page: Page) {
  await page.goto("/today?view=list");
  await hydrated(page);
}

/** A real touch, through the browser's own input, so it arrives as touch pointer events and can scroll the page. */
async function touch(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, holdMs = 0) {
  const cdp = await page.context().newCDPSession(page);
  const point = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  if (holdMs) await page.waitForTimeout(holdMs);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(at) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function middle(row: Locator) {
  await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = (await row.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

signedIn.describe("on a touch screen", () => {
  signedIn.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } });

  signedIn("a swipe right ticks a row, a swipe left shows Plan and Delete, and Delete has Undo", async ({ page }) => {
    await openList(page);
    const row = list(page).locator("[data-swipe]").filter({ has: page.getByRole("button", { name: /^Call the plumber/ }) });
    const at = await middle(row);
    await touch(page, { x: at.x - 60, y: at.y }, { x: at.x + 60, y: at.y });
    await expect(list(page).getByRole("checkbox", { name: "Done: Call the plumber" })).toBeChecked();

    const back = await middle(row);
    await touch(page, { x: back.x + 60, y: back.y }, { x: back.x - 60, y: back.y });
    const actions = row.getByRole("group", { name: "Actions for Call the plumber" });
    await expect(actions.getByRole("button", { name: "Plan Call the plumber" })).toBeVisible();
    await actions.getByRole("button", { name: "Delete Call the plumber" }).click();
    await expect(title(page, "Call the plumber")).toHaveCount(0);
    await expect(note(page)).toHaveText("Call the plumber is deleted.");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(title(page, "Call the plumber")).toBeVisible();
  });

  signedIn("a vertical drag on a row still scrolls the page, and leaves the row alone", async ({ page }) => {
    await openList(page);
    const row = list(page).locator("[data-swipe]").filter({ has: page.getByRole("button", { name: /^Dentist/ }) });
    const at = await middle(row);
    const before = await page.evaluate(() => window.scrollY);
    await touch(page, { x: at.x, y: at.y + 100 }, { x: at.x + 10, y: at.y - 120 });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await expect(page.locator("[data-swipe-strip]")).toHaveCount(0);
    await expect(list(page).getByRole("checkbox", { name: "Done: Dentist" })).not.toBeChecked();
  });

  signedIn("a long press opens the row's menu, and Choose starts choosing rows with taps", async ({ page }) => {
    await openList(page);
    const at = await middle(title(page, "Call the plumber"));
    await touch(page, at, at, 700);
    const menu = page.getByRole("menu", { name: "Actions for Call the plumber" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /^Choose/ }).click();
    const bar = page.getByRole("toolbar", { name: "1 chosen" });
    await expect(bar).toBeVisible();
    await title(page, "Dentist").tap();
    await expect(page.getByRole("toolbar", { name: "2 chosen" })).toBeVisible();
    await expect(page).toHaveURL(/view=list$/);
    await page.getByRole("toolbar").getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("toolbar")).toHaveCount(0);
  });

  signedIn("the Score's beams never swipe", async ({ page }) => {
    await page.goto("/today");
    await hydrated(page);
    await expect(page.getByRole("region", { name: "Score", exact: true }).locator("[data-swipe]")).toHaveCount(0);
  });
});

signedIn.describe("a change to many", () => {
  signedIn("Ctrl with a click chooses rows, and Done and its Undo act on all of them", async ({ page }) => {
    await openList(page);
    await title(page, "Call the plumber").click({ modifiers: ["Control"] });
    await title(page, "Dentist").click({ modifiers: ["Control"] });
    const bar = page.getByRole("toolbar", { name: "2 chosen" });
    await expect(bar).toBeVisible();
    await expect(page).toHaveURL(/view=list$/);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await bar.getByRole("button", { name: "Done" }).click();
    await expect(note(page)).toHaveText("2 are done.");
    // Done rows fold under the List's "Done" line.
    await expect(title(page, "Call the plumber")).toBeHidden();
    await expect(title(page, "Dentist")).toBeHidden();
    await expect(page.getByRole("toolbar")).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(list(page).getByRole("checkbox", { name: "Done: Call the plumber" })).not.toBeChecked();
    await expect(list(page).getByRole("checkbox", { name: "Done: Dentist" })).not.toBeChecked();
  });

  signedIn("X chooses the row in focus, Shift with a click takes the rows between, Escape lets them go", async ({ page }) => {
    await openList(page);
    await title(page, "Standup").focus();
    await page.keyboard.press("x");
    await expect(page.getByRole("toolbar", { name: "1 chosen" })).toBeVisible();
    await title(page, "Call the plumber").click({ modifiers: ["Shift"] });
    await expect(page.getByRole("toolbar", { name: /^[3-9] chosen$/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("toolbar")).toHaveCount(0);
    await expect(list(page).locator("[data-picked]")).toHaveCount(0);
  });

  signedIn("Delete takes the chosen rows with one Undo, skipping one time a series happens", async ({ page }) => {
    await openList(page);
    await title(page, "Standup").click({ modifiers: ["Control"] });
    await title(page, "Dentist").click({ modifiers: ["Control"] });
    await page.getByRole("toolbar", { name: "2 chosen" }).getByRole("button", { name: "Delete" }).click();
    await expect(title(page, "Standup")).toHaveCount(0);
    await expect(title(page, "Dentist")).toHaveCount(0);
    await expect(note(page)).toHaveText("2 are deleted.");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(note(page)).toHaveText("2 are back.");
    await expect(title(page, "Standup")).toBeVisible();
    await expect(title(page, "Dentist")).toBeVisible();
  });

  signedIn("Plan and Area act on all the chosen rows", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    await page.getByRole("button", { name: /^Read the lease/ }).click({ modifiers: ["Control"] });
    await page.getByRole("button", { name: /^Book flights to Lisbon/ }).click({ modifiers: ["Control"] });
    const bar = page.getByRole("toolbar", { name: "2 chosen" });
    await bar.getByRole("button", { name: "Area" }).click();
    await page.getByRole("dialog", { name: "Area for 2 items" }).getByRole("button", { name: "Work" }).click();
    await expect(note(page)).toHaveText("2 are in Work now.");

    await page.getByRole("button", { name: /^Read the lease/ }).click({ modifiers: ["Control"] });
    await page.getByRole("button", { name: /^Book flights to Lisbon/ }).click({ modifiers: ["Control"] });
    await page.getByRole("toolbar", { name: "2 chosen" }).getByRole("button", { name: "Plan" }).click();
    await page.getByRole("dialog", { name: "Plan 2 items" }).getByRole("button", { name: "Tomorrow" }).click();
    await expect(note(page)).toHaveText("2 are planned for tomorrow.");
    await expect(page.getByRole("button", { name: /^Read the lease/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: /^Read the lease/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Book flights to Lisbon/ })).toBeVisible();
  });
});
