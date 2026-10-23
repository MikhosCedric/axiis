import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

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
    { name: "tz", value: zone, url: baseURL },
    { name: "tour", value: "done", url: baseURL },
  ]);
});

const details = (page: Page) => page.getByRole("complementary", { name: "Details" });
const title = (page: Page, name: string) =>
  page.getByRole("region", { name: "Items with no day" }).getByRole("button", { name, exact: true });

signedIn.describe("clearing the Inbox", () => {
  signedIn("the keyboard plans the item in focus and moves on, and Ctrl Z takes the plan back", async ({ page }) => {
    await page.goto("/inbox");
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
    await expect(page.getByRole("status").filter({ hasText: /^Pick a birthday gift is planned for Monday \d+ \w+\.$/ })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByRole("status").filter({ hasText: "Pick a birthday gift is back in the Inbox." })).toBeVisible();
    await expect(title(page, "Pick a birthday gift")).toBeFocused();
  });

  signedIn("Undo on the note takes a plan back, and 4 opens the date field", async ({ page }) => {
    await page.goto("/inbox");
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
    await page.goto("/inbox");
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
    await page.goto("/day/2030-01-02");
    await expect(page).toHaveTitle("Wednesday 2 January 2030 · Axiis");
    // The visit is written a beat after the title, so wait for it to land before leaving.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("axiis-recent") ?? "")).toContain("/day/2030-01-02");

    await page.goto("/due");
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await expect(async () => {
      await page.keyboard.press("c");
      await expect(palette).toBeVisible({ timeout: 500 });
    }).toPass();
    await palette.getByRole("combobox").fill("");
    await expect(palette.getByRole("combobox")).toBeFocused();
    await expect(palette.getByRole("group", { name: "Recent" }).getByRole("option")).toHaveText(["Wednesday 2 January 2030"]);
    await expect(palette.getByRole("option", { name: "Inbox, Captured, with no day yet" })).toContainText("GI");
    await expect(palette.getByRole("status")).toHaveText("Try “next friday”, “nov 3”, a #tag, or a line to capture.");

    await palette.getByRole("option", { name: "Wednesday 2 January 2030" }).click();
    await expect(page).toHaveURL(/\/day\/2030-01-02$/);
  });

  signedIn("C on a page with a capture field still goes to that field", async ({ page }) => {
    await page.goto("/inbox");
    // The key is wired once the page hydrates, so press until it is.
    await expect(async () => {
      await page.locator("h1").click();
      await page.keyboard.press("c");
      await expect(page.getByLabel("Capture anything")).toBeFocused({ timeout: 500 });
    }).toPass();
    await expect(page.getByRole("dialog", { name: "Search and commands" })).toBeHidden();
  });
});

signedIn.describe("the detail panel and history", () => {
  signedIn("Escape closes the panel from a list page and focus goes back to the row", async ({ page }) => {
    await page.goto("/inbox");
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
    await page.goto("/due");
    await page.goto("/inbox");
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
    await page.goto("/inbox");
    await page.getByRole("button", { name: "Pick a birthday gift", exact: true }).click();
    await expect(page).toHaveURL(/[?&]item=/);
    const url = page.url();

    await page.goto("/today");
    await page.goto(url);
    await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Pick a birthday gift");
    await page.keyboard.press("Escape");
    await expect(details(page)).toBeHidden();
    await expect(page).toHaveURL(/\/inbox$/);
  });
});
