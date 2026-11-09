import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The navigation account is a busy week of its own (docs/e2e-session.md), seeded around the server's real today in
// the server's zone, so these tests can plan and tick without touching what the orientation tests read.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ACCOUNT = "navigation";

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=${ACCOUNT}` } });

signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([
    { name: "axiis-e2e-account", value: ACCOUNT, url: baseURL },
    { name: "tour", value: "done", url: baseURL },
  ]);
});

/** Opens a page and waits until it answers keys, since every key these tests press is a listener React attaches. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

const details = (page: Page) => page.getByRole("complementary", { name: "Details" });
const title = (page: Page, name: string) =>
  page.getByRole("region", { name: "Items with no day" }).getByRole("button", { name, exact: true });

signedIn.describe("clearing the Inbox", () => {
  signedIn("the keyboard plans the item in focus and moves on, and Ctrl Z takes the plan back", async ({ page }) => {
    await open(page, "/inbox");
    await title(page, "Book flights to Lisbon").focus();
    await page.keyboard.press("2");
    await expect(page.getByRole("status").filter({ hasText: "Book flights to Lisbon is planned for tomorrow." })).toBeVisible();
    await expect(title(page, "Book flights to Lisbon")).toHaveCount(0);
    await expect(title(page, "Read the lease")).toBeFocused();

    await page.keyboard.press("j");
    await expect(title(page, "Pick a birthday gift")).toBeFocused();
    await page.keyboard.press("k");
    await expect(title(page, "Read the lease")).toBeFocused();
    await page.keyboard.press("j");
    await page.keyboard.press("3");
    // 3 is next week, which starts on the coming Monday; on a Sunday that is tomorrow, and the app says so.
    await expect(page.getByRole("status").filter({ hasText: /^Pick a birthday gift is planned for (?:tomorrow|Monday \d+ \w+)\.$/ })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByRole("status").filter({ hasText: "Pick a birthday gift is back in the Inbox." })).toBeVisible();
    await expect(title(page, "Pick a birthday gift")).toBeFocused();
  });

  signedIn("Undo on the note takes a plan back, and 4 opens the date field", async ({ page }) => {
    await open(page, "/inbox");
    await page.getByRole("button", { name: "Plan for: Read the lease" }).click();
    const choices = page.getByRole("group", { name: "Plan Read the lease for" });
    await expect(choices.getByRole("button")).toHaveText(["Today1", "Tomorrow2", "Next week3", "Plan"]);
    await choices.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Read the lease is planned for today." })).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(title(page, "Read the lease")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Read the lease is back in the Inbox." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

    await title(page, "Read the lease").focus();
    await page.keyboard.press("4");
    await expect(page.getByRole("group", { name: "Plan Read the lease for" }).getByLabel("Another day")).toBeFocused();
  });

  signedIn("planning the last item says the Inbox is clear", async ({ page }) => {
    await open(page, "/inbox");
    const plans = page.getByRole("button", { name: /^Plan for: / });
    await expect(plans).toHaveCount(4);
    await page.locator("[data-open]").first().focus();
    for (const left of [3, 2, 1, 0]) {
      await page.keyboard.press("1");
      await expect(plans).toHaveCount(left);
    }
    await expect(page.getByText("All planned. Anything you capture without a day lands here")).toBeVisible();
  });
});

signedIn.describe("the palette as a way around", () => {
  signedIn("C opens it where a page has no capture field, and it offers the pages visited lately with each place's key", async ({ page }) => {
    await open(page, "/day/2030-01-02");
    await expect(page).toHaveTitle("Wednesday 2 January 2030 · Axiis");
    // The visit is written a beat after the title, so wait for it to land before leaving.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("axiis-recent") ?? "")).toContain("/day/2030-01-02");

    await open(page, "/due");
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await page.keyboard.press("c");
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill("");
    await expect(palette.getByRole("combobox")).toBeFocused();
    await expect(palette.getByRole("group", { name: "Recent" }).getByRole("option")).toHaveText(["Wednesday 2 January 2030"]);
    await expect(palette.getByRole("option", { name: "Inbox, Captured, with no day yet" })).toContainText("GI");
    await expect(palette.getByRole("status")).toHaveText("Try “next friday”, “nov 3”, a #tag, or a line to capture.");

    await palette.getByRole("option", { name: "Wednesday 2 January 2030" }).click();
    await expect(page).toHaveURL(/\/day\/2030-01-02$/);
  });

  signedIn("C on a page with a capture field still goes to that field", async ({ page }) => {
    await open(page, "/inbox");
    await page.locator("h1").click();
    await page.keyboard.press("c");
    await expect(page.getByLabel("Capture anything")).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Search and commands" })).toBeHidden();
  });
});

signedIn.describe("the Week on a phone", () => {
  signedIn.use({ viewport: { width: 375, height: 812 } });

  signedIn("opens at Monday with a link down to today", async ({ page }) => {
    await open(page, "/week");
    const today = page.locator("h3", { hasText: "Today" });
    const jump = page.getByRole("link", { name: /^Jump to today, \w+day$/ });
    const monday = (await page.locator("h3").first().textContent())?.includes("Today");
    if (monday) {
      await expect(jump).toHaveCount(0);
      return;
    }
    await expect(page.locator(".page-summary").first()).toBeInViewport();
    await jump.click();
    await expect(today).toBeInViewport();
  });

  signedIn("Previous and Next keep their names when they shrink to chevrons", async ({ page }) => {
    await open(page, "/week");
    const steps = page.getByRole("navigation", { name: "Week" });
    await expect(steps.getByRole("link", { name: /^Previous week, / })).toBeVisible();
    await expect(steps.getByRole("link", { name: /^Next week, / })).toBeVisible();
    for (const link of await steps.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    const group = steps.getByRole("group", { name: "Day, week or month" });
    await expect(group.getByRole("link")).toHaveText(["Day", "Week", "Month"]);
    const [switchBox, previousBox] = [await group.boundingBox(), await steps.getByRole("link", { name: /^Previous week/ }).boundingBox()];
    expect(Math.abs(switchBox!.y - previousBox!.y)).toBeLessThan(2);
  });
});

signedIn.describe("the detail panel and history", () => {
  signedIn("Escape closes the panel from a list page and focus goes back to the row", async ({ page }) => {
    await open(page, "/inbox");
    const row = page.getByRole("button", { name: "Book flights to Lisbon", exact: true });
    await row.click();
    await expect(details(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]item=/);

    await page.keyboard.press("Escape");
    await expect(details(page)).toBeHidden();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(row).toBeFocused();
  });

  signedIn("Back closes the panel, Forward opens it again, and switching items does not add steps", async ({ page }) => {
    await open(page, "/due");
    await open(page, "/inbox");
    await page.getByRole("button", { name: "Book flights to Lisbon", exact: true }).click();
    await expect(details(page)).toBeVisible();
    await page.getByRole("button", { name: "Read the lease", exact: true }).click();
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Read the lease");

    await page.goBack();
    await expect(details(page)).toBeHidden();
    await expect(page).toHaveURL(/\/inbox$/);

    await page.goForward();
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Read the lease");

    // Closing with the button steps back too, so one more Back leaves the Inbox.
    await details(page).getByRole("link", { name: "Close details" }).click();
    await expect(details(page)).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/due$/);
  });

  signedIn("a link with ?item= opens the panel, and closing it stays on the page", async ({ page }) => {
    await open(page, "/inbox");
    await page.getByRole("button", { name: "Pick a birthday gift", exact: true }).click();
    await expect(page).toHaveURL(/[?&]item=/);
    const url = page.url();

    await open(page, "/today");
    await open(page, url);
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Pick a birthday gift");
    // The panel is drawn on the server; Escape is heard once the page hydrates, so press until it is.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await expect(details(page)).toBeHidden({ timeout: 500 });
    }).toPass();
    await expect(page).toHaveURL(/\/inbox$/);
  });
});

signedIn.describe("managing from the details", () => {
  signedIn("an area is made from the details and then picked", async ({ page }) => {
    await open(page, "/inbox");
    await title(page, "Read the lease").click();
    await expect(details(page)).toBeVisible();
    const fold = details(page).getByRole("button", { name: "Area", exact: true });
    if (await fold.count()) await fold.click();
    await details(page).getByRole("button", { name: "New area" }).click();
    await details(page).getByRole("textbox", { name: "New area name" }).fill("Studio");
    await page.keyboard.press("Enter");
    await expect(details(page).getByText("Studio added.")).toBeVisible();
    await expect(details(page).getByRole("combobox", { name: "Area" }).getByRole("option", { name: "Studio" })).toBeAttached();
  });

  signedIn("a deleted item is listed under Recently deleted and can be restored", async ({ page }) => {
    await open(page, "/inbox");
    await title(page, "Read the lease").click();
    await details(page).getByRole("button", { name: /^Delete this/ }).click();
    await details(page).getByRole("group").getByRole("button", { name: "Yes" }).click();
    await expect(details(page)).toBeHidden();

    await open(page, "/trash");
    await expect(page.getByRole("heading", { level: 1, name: "Recently deleted" })).toBeVisible();
    await page.getByRole("button", { name: "Restore Read the lease" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Read the lease is back." })).toBeVisible();
    await expect(page.getByText("Nothing deleted lately.")).toBeVisible();
  });
});

signedIn.describe("capturing with no connection", () => {
  signedIn("a capture typed offline is kept on the device and sent once, when the connection returns", async ({ page }) => {
    await open(page, "/inbox");
    const field = page.getByLabel("Capture anything");
    await page.context().setOffline(true);
    await field.fill("Call the vet from the train");
    await field.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Saved on this device. It will be sent when you are back online." })).toBeVisible();
    const waiting = page.getByRole("region", { name: "Captures waiting" });
    await expect(waiting).toContainText("1 capture is saved on this device");
    await expect(title(page, "Call the vet from the train")).toHaveCount(0);

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(waiting).toBeHidden();
    await expect(title(page, "Call the vet from the train")).toHaveCount(1);
  });
});

signedIn.describe("reading with no connection", () => {
  signedIn("a page read lately opens offline from the saved copy, one never read says so, and sign-out drops them", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "axiis-sw", value: "1", url: baseURL }]);
    await open(page, "/inbox");
    // The worker takes the page over, then keeps it; wait until the copy exists before going offline.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(async () => page.evaluate(async () => (await (await caches.open("axiis-pages-v1")).keys()).map((r) => new URL(r.url).pathname)), { timeout: 15000 })
      .toContain("/inbox");

    await context.setOffline(true);
    await page.goto("/inbox");
    await expect(title(page, "Book flights to Lisbon")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Offline. You are seeing the last saved copy of this page." })).toBeVisible();

    await page.goto("/week");
    await expect(page.getByRole("heading", { name: "Axiis is offline" })).toBeVisible();
    await context.setOffline(false);

    await page.goto("/inbox");
    await hydrated(page);
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    // The sign-in page re-fills only the cache of public, hashed assets; what was read is gone.
    await expect.poll(() => page.evaluate(() => caches.has("axiis-pages-v1"))).toBe(false);
  });
});

signedIn.describe("an item on its own page", () => {
  signedIn("the panel links to it, and it opens with no way to close or open again", async ({ page }) => {
    await open(page, "/inbox");
    await page.getByRole("button", { name: "Read the lease", exact: true }).click();
    const link = details(page).getByRole("link", { name: "Open in a new window" });
    await expect(link).toHaveAttribute("target", "_blank");
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/item\/[0-9a-f-]{36}$/);

    await open(page, href!);
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Read the lease");
    await expect(page.getByRole("link", { name: "Close details" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open in a new window" })).toHaveCount(0);
  });

  signedIn("an address that is not an item key is not found", async ({ page }) => {
    const response = await page.goto("/item/not-a-key");
    expect(response?.status()).toBe(404);
  });
});
