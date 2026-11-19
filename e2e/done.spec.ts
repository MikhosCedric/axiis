import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=busy` } });

// One in-memory account is shared by every worker, and these tests tick it, so they run one at a time.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

async function useBusy(page: Page, request: APIRequestContext, baseURL: string | undefined) {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([{ name: "axiis-e2e-account", value: "busy", url: baseURL }]);
}

signedIn.describe("Done", () => {
  signedIn.beforeEach(async ({ page, request, baseURL }) => useBusy(page, request, baseURL));

  signedIn("lists what was finished under its day, and unticking reopens it", async ({ page }) => {
    await page.goto("/done");
    await expect(page.getByRole("heading", { level: 1, name: "Done" })).toBeVisible();
    const today = page.getByRole("region", { name: /^Today/ });
    await expect(today.getByRole("heading", { level: 2 })).toContainText("3 items");
    await expect(today.getByText("Morning run")).toBeVisible();
    await expect(today.getByText("Write the Q4 plan")).toBeVisible();
    // No subtasks, no open items, no praise.
    await expect(page.getByText("Milk")).toHaveCount(0);
    await expect(page.getByText("Focus block")).toHaveCount(0);
    await expect(page.getByText(/!/)).toHaveCount(0);

    await hydrated(page);
    await today.getByRole("checkbox", { name: "Done: Morning run" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: "Morning run" })).toContainText("open again");
    await page.goto("/done");
    await expect(page.getByRole("region", { name: /^Today/ }).getByText("Morning run")).toHaveCount(0);
  });

  signedIn("a day heading opens that day, and the header counts the week plainly", async ({ page }) => {
    await page.goto("/done");
    await expect(page.getByRole("link", { name: /^Today/ })).toHaveAttribute("href", "/today");
    await expect(page.getByText(/^This week: \d+\+? done$/)).toBeVisible();
    await page.goto("/done?area=anything");
    await expect(page.getByText(/streak|best|record/i)).toHaveCount(0);
  });

  signedIn("Plan again reopens a finished item for today, and Undo puts it back done", async ({ page }) => {
    await page.goto("/done");
    await hydrated(page);
    const today = page.getByRole("region", { name: /^Today/ });
    await today.getByRole("button", { name: "Plan again: Morning run" }).click();
    await expect(page.getByText("Morning run is open again, planned for today.")).toBeVisible();
    await expect(today.getByText("Morning run")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Morning run is back as it was.")).toBeVisible();
    await page.goto("/done");
    await expect(page.getByRole("region", { name: /^Today/ }).getByText("Morning run")).toBeVisible();
  });

  signedIn("narrows to an area, and G then F goes there", async ({ page }) => {
    await page.goto("/today");
    await hydrated(page);
    await page.keyboard.press("g");
    await page.keyboard.press("f");
    await expect(page).toHaveURL(/\/done$/);
    // A then a digit narrows the page to an area, in the side panel's order.
    await page.keyboard.press("a");
    await page.keyboard.press("3");
    await expect(page).toHaveURL(/area=/);
    await expect(page.getByText("Morning run")).toBeVisible();
    await expect(page.getByText("Write the Q4 plan")).toHaveCount(0);
  });

  // The busy account is reset for every test here, so what is left over is still there; the default account loses it to the Today test in signed-in.spec.ts.
  for (const path of ["/week", "/month"]) {
    signedIn(`${path} keeps what is left over in one quiet line that opens to its items`, async ({ page }) => {
      await page.goto(path);
      await hydrated(page);
      const line = page.getByRole("region", { name: "Left over from earlier days" });
      await expect(line).toContainText("left over from earlier days");
      await expect(line.getByRole("button", { name: "Move to today" })).toBeVisible();
      const show = line.getByRole("button", { name: "Show" });
      await expect(show).toHaveAttribute("aria-expanded", "false");
      await expect(line.getByRole("button", { name: "Return the library books", exact: true })).toHaveCount(0);
      await show.click();
      await expect(line.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
      await expect(line.getByRole("button", { name: "Return the library books", exact: true })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    });
  }

  // Here and not in a spec of its own: the busy account is shared by every worker, and this moves its items.
  signedIn("Plan the rest of today for tomorrow moves the open tasks in one note, and Undo puts them back", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/today");
    await hydrated(page);
    const plan = page.getByRole("button", { name: "Plan the rest of today for tomorrow" });
    await expect(plan).toBeVisible();
    await plan.click();
    // Call the plumber, Send the invoice and Groceries: the event, the live block and what is done stay.
    await expect(page.getByText("3 things are planned for tomorrow.")).toBeVisible();
    await expect(plan).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Done: Send the invoice" })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Back on today.")).toBeVisible();
    await expect(plan).toBeVisible();
  });

  signedIn("Plan the rest of today for tomorrow is not offered on another day", async ({ page }) => {
    await page.goto("/day/2099-05-20");
    await hydrated(page);
    await expect(page.getByRole("button", { name: "Plan the rest of today for tomorrow" })).toHaveCount(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    signedIn(`/done has no serious or critical axe violations (${scheme}, 375px)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto("/done");
      await expect(page.getByRole("heading", { level: 1, name: "Done" })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    });
  }
});
