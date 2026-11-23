import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The busy account seeds its week around the server's real today in the server's own zone; the browser takes that zone too.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=actions` } });

// One in-memory account is shared by every worker, and these tests change it, so they run one at a time.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([{ name: "axiis-e2e-account", value: "actions", url: baseURL }]);
});

const dialog = (page: Page) => page.getByRole("dialog", { name: "Search and commands" });
const status = (page: Page) => dialog(page).getByRole("status");
const note = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).last();

async function openPalette(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
  await page.keyboard.press("Control+k");
  const box = dialog(page).getByRole("combobox");
  await expect(box).toBeFocused();
  return box;
}

/** Finds the item by its words and opens its actions. */
async function openItem(page: Page, box: ReturnType<Page["getByRole"]>, words: string, name: string) {
  await box.fill(words);
  await page.getByRole("option", { name }).click();
  await expect(dialog(page).getByRole("group", { name: `Actions for “${words.replace(/^./, (c) => c.toUpperCase())}”` })).toBeVisible();
}

const act = (page: Page, name: string) => dialog(page).getByRole("option", { name, exact: true });

signedIn.describe("the palette acts on an item", () => {
  signedIn("plans it for next week, sends it back to the Inbox, copies it to tomorrow and changes its type", async ({ page }) => {
    const box = await openPalette(page, "/inbox");
    await openItem(page, box, "read the lease", "Read the lease, Task");
    await expect(act(page, "Move to Inbox")).toHaveCount(0);

    await act(page, "Plan for next week").click();
    await expect(status(page)).toHaveText("“Read the lease” is planned for next week.");
    await act(page, "Move to Inbox").click();
    await expect(status(page)).toHaveText("“Read the lease” is in the Inbox.");
    await expect(act(page, "Move to Inbox")).toHaveCount(0);

    await act(page, "Duplicate to tomorrow").click();
    await expect(status(page)).toHaveText("“Read the lease” is copied to tomorrow.");

    await act(page, "Make event").click();
    await expect(status(page)).toHaveText("“Read the lease” is an event now.");
    await expect(act(page, "Make task")).toBeVisible();
    await expect(act(page, "Make event")).toHaveCount(0);
  });

  signedIn("deletes it with the same Undo a row has", async ({ page }) => {
    const box = await openPalette(page, "/inbox");
    await openItem(page, box, "read the lease", "Read the lease, Task");
    await act(page, "Delete").click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole("button", { name: /^Read the lease/ })).toHaveCount(0);
    await expect(note(page)).toHaveText("“Read the lease” is deleted.");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(note(page)).toHaveText("“Read the lease” is back.");
    await expect(page.getByRole("button", { name: /^Read the lease/ })).toBeVisible();
  });
});

signedIn.describe("the palette's commands", () => {
  signedIn("switch density, theme and the first day of the week, as Settings does", async ({ page }) => {
    const box = await openPalette(page, "/today");
    await box.fill("density");
    await expect(page.getByRole("option", { name: "Density: spacious" })).toHaveCount(0);
    await page.getByRole("option", { name: "Density: compact" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    await expect(status(page)).toHaveText("Density is compact.");

    await box.fill("dark");
    await box.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await box.fill("sunday");
    await box.press("Enter");
    await expect(status(page)).toHaveText("The week starts on Sunday.");
    await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "week-start")?.value).toBe("sunday");
  });

  signedIn("plan the rest of today for tomorrow, with Undo", async ({ page }) => {
    const box = await openPalette(page, "/inbox");
    await box.fill("water the ferns today");
    await box.press("Enter");
    await expect(status(page)).toContainText("Planned for today");
    await box.fill("rest of today");
    await box.press("Enter");
    await expect(dialog(page)).toBeHidden();
    await expect(note(page)).toHaveText(/planned for tomorrow\.$/);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(note(page)).toHaveText("Back on today.");
  });
});

signedIn.describe("connected rows", () => {
  signedIn("Add a note in the More menu makes a linked note and opens it in one step", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    await page.getByRole("button", { name: /^Read the lease/ }).focus();
    await page.keyboard.press(".");
    await page.getByRole("menuitem", { name: "Add a note" }).click();
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);
  });

  signedIn("a capture on a page narrowed to one area lands in that area", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    // A, then the first area in the rail's order.
    await page.keyboard.press("a");
    await page.keyboard.press("1");
    await expect(page).toHaveURL(/area=/);
    await page.locator("#capture").fill("Buy stamps");
    await page.locator("#capture").press("Enter");
    await expect(page.locator("#capture-status")).toContainText("In Work");
  });

  signedIn("a Due row with no day offers Today and Tomorrow, and plans it", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    await page.locator("#capture").fill("Send invoice due friday");
    await page.locator("#capture").press("Enter");
    await expect(page.locator("#capture-status")).toContainText("Captured");
    await page.goto("/due");
    await hydrated(page);
    await page.getByRole("button", { name: "Plan Send invoice for tomorrow" }).click();
    await expect(note(page)).toHaveText("Send invoice is planned for tomorrow.");
  });
});
