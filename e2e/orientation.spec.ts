import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The busy account seeds its week around the server's real today in the server's own zone. The server and
// the browser run on one machine, so the browser takes that zone too, and the tz cookie says it from the start.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const reset = (request: APIRequestContext, account: "busy" | "empty") =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=${account}` } });

// One in-memory account is shared by every worker, and these tests tick and toggle it, so they run one at a time.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

async function useAccount(page: Page, request: APIRequestContext, baseURL: string | undefined, account: "busy" | "empty") {
  expect((await reset(request, account)).status()).toBe(204);
  await page.context().addCookies([{ name: "axiis-e2e-account", value: account, url: baseURL }]);
}

const glance = (page: Page) => page.locator("[data-glance]");

signedIn.describe("a busy day", () => {
  signedIn.beforeEach(async ({ page, request, baseURL }) => {
    await useAccount(page, request, baseURL, "busy");
  });

  signedIn("Today says where the day stands and shows the one next thing, the Week and the Month count what is open", async ({ page }) => {
    await page.goto("/today");
    // Morning run, the Q4 plan and the plants are done in the seed; what else the day holds depends on the weekday.
    // Focus block is seeded around now; another seeded item can share the hour, so it need not be the only one.
    await expect(glance(page)).toHaveText(/^Today · 3 of \d+ done( · \d+ due)?$/);
    await expect(glance(page)).toContainText("due");

    const next = page.getByRole("region", { name: "Next up" });
    // Design sync (16:00 to 17:00) is live too in that hour, and Next up shows one item, so either may lead.
    await expect(next.getByRole("listitem")).toHaveCount(1);
    await expect(next.getByRole("listitem")).toContainText(/^(Focus block|Design sync)\s*Now, until/);

    // A due date carries the same mark on the grid as in Next up.
    await expect(page.getByRole("button", { name: /^(?=.*Due today)Send the invoice.*any time.*Work, planned/ })).toBeVisible();

    // Done in Any time stays in the row, faded and named done.
    await expect(page.locator("[data-anytime] li").getByRole("button", { name: /^Water the plants.*done/ })).toBeVisible();

    await page.goto("/week");
    await expect(page.locator(".page-summary").first()).toHaveText(/^\d+ open( · \d+ due)?$/);
    await page.goto("/month");
    await expect(page.locator(".page-summary").first()).toHaveText(/^\d+ open( · \d+ due)?$/);
  });

  signedIn("ticking the first thing in Next up brings the next one up", async ({ page }) => {
    await page.goto("/today");
    const next = page.getByRole("region", { name: "Next up" });
    await next.getByRole("checkbox", { name: "Done: Focus block" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: "Focus block is done." })).toBeVisible();
    await expect(next.getByText("Focus block")).toHaveCount(0);
    await expect(glance(page)).toHaveText(/^Today · 4 of \d+ done/);
  });

  signedIn("Focus keeps only what is next and folds the rest, and the device remembers it", async ({ page }) => {
    await page.goto("/today");
    const focus = page.getByRole("button", { name: "Focus", exact: true });
    await expect(focus).toHaveAttribute("aria-pressed", "false");
    await focus.click();
    await expect(focus).toHaveAttribute("aria-pressed", "true");

    // Focus dims the grid to what is happening now, and leaves only Next up beside it.
    const planned = page.locator('[data-calendar-grid] [data-state="planned"]').first();
    const live = page.locator('[data-calendar-grid] [data-state="live"]').first();
    const leftOver = page.locator("#leftover-h");
    await expect(planned).toHaveCSS("opacity", "0.38");
    await expect(live).toHaveCSS("opacity", "1");
    await expect(leftOver).toBeHidden();
    await expect(page.getByRole("region", { name: "Next up" }).getByRole("button", { name: "Send the invoice", exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Focus", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(planned).toHaveCSS("opacity", "0.38");

    await page.getByRole("button", { name: "Focus", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Focus", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(planned).toHaveCSS("opacity", "1");
    await expect(leftOver).toBeVisible();
  });

  for (const { width, colorScheme } of [
    { width: 1440, colorScheme: "light" as const },
    { width: 375, colorScheme: "dark" as const },
  ]) {
    signedIn(`Today at ${width} in ${colorScheme} has no axe violations, and Next up is on the first screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/today");
      // On a phone Next up is one line that opens the card; wide, it is the card.
      const box = await (width < 760 ? page.getByRole("button", { name: /^Next up: / }) : page.getByRole("heading", { name: "Next up" })).boundingBox();
      expect(box!.y).toBeLessThan(812);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations).toEqual([]);
    });
  }
});

// A new account sees the tour (readTour's unit test). Here it is asked for through the cookie the Guide writes,
// on the busy account, since the shared empty account belongs to the first-day spec running alongside.
signedIn.describe("the tour", () => {
  signedIn.beforeEach(async ({ page, request, baseURL }) => {
    await useAccount(page, request, baseURL, "busy");
    await page.context().addCookies([{ name: "tour", value: "replay", url: baseURL }]);
  });

  signedIn("steps through three steps once, and the Guide brings them back", async ({ page, baseURL }) => {
    await page.goto("/today");
    const tour = page.getByRole("region", { name: "The grid is your day" });
    await expect(tour).toBeVisible();
    await expect(tour).toContainText("1 of 3");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    for (const title of ["Inbox or Today", "The Guide explains the rest"]) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByRole("region", { name: title })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Skip the tour" })).toHaveCount(0);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("region", { name: "The Guide explains the rest" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("region", { name: "The grid is your day" })).toHaveCount(0);

    await page.getByRole("button", { name: "Guide" }).click();
    const guide = page.getByRole("dialog");
    await expect(guide.getByRole("list", { name: "Kinds of item" }).getByRole("listitem")).toHaveCount(3);
    await guide.getByRole("button", { name: "Take the tour again" }).click();
    await expect(page.getByRole("region", { name: "The grid is your day" })).toBeVisible();
    await page.getByRole("button", { name: "Skip the tour" }).click();
    await expect(page.getByRole("region", { name: "The grid is your day" })).toHaveCount(0);
    expect((await page.context().cookies(baseURL)).find((c) => c.name === "tour")?.value).toBe("done");
  });
});
