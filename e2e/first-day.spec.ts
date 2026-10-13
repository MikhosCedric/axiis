import AxeBuilder from "@axe-core/playwright";
import { expect as defaultExpect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionSecret, signedIn } from "./session";

const expect = defaultExpect.configure({ timeout: 30_000 });

const HOUR_PX = 76;
const LEAD = "Type one thing you have to do. Add a day or a time and it lands on its line.";
const NOTE = "The faint beams are examples. They go once you add your first item.";
const FIRST_EXAMPLE = "dentist tomorrow 9:00 #health";

const field = (page: Page) => page.locator("#capture");
const status = (page: Page) => page.locator("#capture-status");
const examples = (page: Page) => page.locator("[data-example]");

async function capture(page: Page, text: string) {
  await field(page).fill(text);
  await field(page).press("Enter");
}

/** Each example's title and clock, the staff label beside it, and whether the page scrolls sideways. */
async function drawn(page: Page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll<HTMLElement>("[data-staff-label]")];
    const beams = [...document.querySelectorAll<HTMLElement>("[data-example]")].map((el) => {
      const r = el.getBoundingClientRect();
      const staff = labels.find((l) => {
        const s = l.getBoundingClientRect();
        return r.top >= s.top && r.bottom <= s.bottom;
      });
      return {
        text: el.textContent,
        staff: staff?.textContent ?? null,
        hidden: el.getAttribute("aria-hidden"),
        events: getComputedStyle(el).pointerEvents,
      };
    });
    const hours = [...document.querySelectorAll<HTMLElement>("[data-hour]")].map((t) => Number(t.dataset.hour));
    const label = labels[0];
    const scroller = label.closest<HTMLElement>(".overflow-x-auto")!;
    return {
      beams,
      hourCount: hours.length,
      bodyWidth: label.nextElementSibling!.getBoundingClientRect().width,
      gap: scroller.getBoundingClientRect().right - label.nextElementSibling!.getBoundingClientRect().right,
      axisScrolls: scroller.scrollWidth > scroller.clientWidth,
      pageScrolls: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

const WIDTHS = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
] as const;

for (const viewport of WIDTHS) {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`first day at ${viewport.width}, ${colorScheme}`, () => {
      test.use({ viewport, colorScheme });

      test("draws one example per area, hides the empty furniture, and passes axe", async ({ page }) => {
        await page.goto("/dev/score?firstday");
        await expect(examples(page)).toHaveCount(3);
        const d = await drawn(page);
        expect(d.beams).toEqual([
          { text: "Write the plan10:00", staff: "Work", hidden: "true", events: "none" },
          { text: "Groceries18:00", staff: "Home", hidden: "true", events: "none" },
          { text: "Walk12:30", staff: "Health", hidden: "true", events: "none" },
        ]);
        expect(d.pageScrolls).toBe(false);
        if (viewport.width >= 1280) {
          expect(d.axisScrolls).toBe(false);
          expect(d.bodyWidth).toBe(d.hourCount * HOUR_PX);
          if (d.hourCount < 24) expect(d.gap).toBeLessThan(HOUR_PX);
        }

        await expect(page.getByText(NOTE)).toBeVisible();
        await expect(page.getByText(LEAD)).toBeVisible();
        await expect(page.getByRole("heading", { name: "Any time" })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Waiting" })).toHaveCount(0);
        await expect(page.getByText(/^\d+ open$/)).toHaveCount(0);
        await expect(page.locator("#score-keys")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Guide" })).toBeVisible();
        await expect(page.getByRole("list", { name: "Key" })).toHaveCount(0);

        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      });
    });
  }
}

test.describe("first-day capture", () => {
  test("turns the placeholder through real examples under a lead line", async ({ page }) => {
    await page.goto("/dev/score?firstday");
    await expect(field(page)).toHaveAttribute("placeholder", FIRST_EXAMPLE);
    await expect(field(page)).toHaveAttribute("aria-describedby", /capture-lead/);
    await expect(field(page)).toHaveAttribute("placeholder", "call Sam friday 14:00 for 30m", { timeout: 6_000 });
  });

  test("keeps the first example still when motion is reduced", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/score?firstday");
    await expect(field(page)).toHaveAttribute("placeholder", FIRST_EXAMPLE);
    // The C shortcut is wired in the same commit as the turning, so once it focuses the field the turning would have begun.
    await expect(async () => {
      await page.locator("h1").click();
      await page.keyboard.press("c");
      await expect(field(page)).toBeFocused({ timeout: 500 });
    }).toPass();
    // Sampled, not retried: a retrying assertion would wait for the turning to come back round.
    const seen = new Set<string | null>();
    for (let i = 0; i < 9; i++) {
      seen.add(await field(page).getAttribute("placeholder"));
      await page.waitForTimeout(500);
    }
    expect([...seen]).toEqual([FIRST_EXAMPLE]);
  });

  test("the first capture says what it understood and links to its day; the examples go; the next capture reads as usual", async ({
    page,
  }) => {
    await page.goto("/dev/score?firstday");
    await expect(examples(page)).toHaveCount(3);
    await capture(page, "dentist tomorrow 9:00 #health");
    await expect(status(page)).toHaveText("Dentist is tomorrow at 09:00, tagged #health. See tomorrow.");
    await expect(status(page).getByRole("link", { name: "See tomorrow" })).toHaveAttribute("href", /^\/day\/\d{4}-\d{2}-\d{2}$/);
    await expect(examples(page)).toHaveCount(0);
    await expect(page.getByText(LEAD)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Any time" })).toBeVisible();
    await expect(field(page)).toHaveAttribute("placeholder", "Capture anything, then place it later");

    await capture(page, "buy milk");
    await expect(status(page)).toHaveText("Captured. It is waiting for a time, below.");
  });

  test("an account with items shows no examples", async ({ page }) => {
    await page.goto("/dev/score?tray=empty");
    await expect(page.locator("[data-staff-label]").first()).toBeVisible();
    await expect(examples(page)).toHaveCount(0);
    await expect(page.getByText(LEAD)).toHaveCount(0);
  });
});

// The real /today, as a second in-memory account that starts with no items (src/lib/supabase/fake-account.ts).
signedIn.describe("first day on the real route", () => {
  signedIn.describe.configure({ mode: "serial", timeout: 90_000 });
  signedIn.use({ timezoneId: "UTC" });

  const reset = (request: APIRequestContext) =>
    request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=empty` } });

  signedIn.beforeEach(async ({ context, request, baseURL }) => {
    expect((await reset(request)).status()).toBe(204);
    await context.addCookies([{ name: "axiis-e2e-account", value: "empty", url: baseURL }]);
  });

  signedIn("an empty account sees examples, and its first capture links to the Inbox, where it is", async ({ page }) => {
    await page.goto("/today");
    await expect(examples(page)).toHaveCount(3);
    await expect(page.getByText(LEAD)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Any time" })).toHaveCount(0);

    await capture(page, "buy milk");
    await expect(status(page)).toHaveText("Buy milk is waiting, with no day yet. See the Inbox.");
    await expect(examples(page)).toHaveCount(0);
    await status(page).getByRole("link", { name: "See the Inbox" }).click();
    await expect(page).toHaveURL("/inbox");
    await expect(page.getByRole("main").getByText("buy milk", { exact: true })).toBeVisible();

    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "Any time" })).toBeVisible();
    await expect(examples(page)).toHaveCount(0);
  });

  signedIn("deleting the only item does not bring the first day back", async ({ page }) => {
    await page.goto("/today");
    await capture(page, "buy milk");
    await expect(examples(page)).toHaveCount(0);
    await page.getByRole("button", { name: /^buy milk, waiting/ }).press("Enter");
    const panel = page.getByRole("complementary", { name: "Details" });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Delete this task" }).click();
    await panel.getByRole("button", { name: "Yes" }).click();
    await expect(page.getByRole("button", { name: /^buy milk, waiting/ })).toHaveCount(0);
    await page.reload();
    await expect(page.locator("[data-staff-label]").first()).toBeVisible();
    await expect(examples(page)).toHaveCount(0);
  });
});
