import { expect, test, type Page } from "@playwright/test";

// How the time grid fits its window: the hours run down the whole day, and the day columns fill the width with no
// empty strip at the right, whatever the window and whether or not the detail panel is open. (This is what the
// Score's hour axis spec guarded for the old horizontal timeline.)

const HOUR_PX = 52;

/** The hour labels as drawn, and how the columns sit in the grid's own scroller. */
async function fit(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-calendar-grid]")!;
    const hours = [...frame.querySelectorAll<HTMLElement>("[data-hour]")];
    const nums = hours.map((t) => Number(t.dataset.hour));
    const tops = hours.map((t) => t.getBoundingClientRect().top);
    const cols = [...frame.querySelectorAll<HTMLElement>("[data-day-col]")].map((c) => c.getBoundingClientRect());
    const edge = frame.getBoundingClientRect().left + frame.clientWidth;
    return {
      first: nums[0],
      last: nums[nums.length - 1],
      count: nums.length,
      step: tops.length > 1 ? tops[1] - tops[0] : 0,
      columns: cols.length,
      columnWidth: cols[0].width,
      gap: edge - cols[cols.length - 1].right,
      scrollsSideways: frame.scrollWidth > frame.clientWidth,
      pageScrolls: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function open(page: Page, query = "?at=12:00") {
  await page.goto(`/dev/day${query}`);
  await expect(page.locator("[data-calendar-grid]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** The columns reach the grid's right edge (to the pixel) and nothing scrolls sideways. */
const isFilled = (a: Awaited<ReturnType<typeof fit>>) => !a.scrollsSideways && !a.pageScrolls && Math.abs(a.gap) < 1.5;
function expectFilled(a: Awaited<ReturnType<typeof fit>>) {
  expect(isFilled(a)).toBe(true);
}

test.describe("on a wide window", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("the hour axis spans the whole day and the day fills the width with no empty strip", async ({ page }) => {
    await open(page);
    const a = await fit(page);
    // Every hour from 01:00 to 23:00 is labelled (midnight is the top edge), an hour apart.
    expect(a.first).toBeLessThanOrEqual(1);
    expect(a.last).toBe(23);
    expect(a.count).toBeGreaterThanOrEqual(23);
    expect(a.step).toBe(HOUR_PX);
    expect(a.columns).toBe(1);
    expectFilled(a);
  });
});

for (const width of [1920, 1280]) {
  test.describe(`at ${width} wide`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the day refills when the detail panel opens and closes", async ({ page }) => {
      await open(page);
      const closed = await fit(page);
      expectFilled(closed);

      const block = page.locator("[data-calendar-grid]").getByRole("button", { name: /^Design sync/ });
      await block.focus();
      await page.keyboard.press("Enter");
      const details = page.getByRole("complementary", { name: "Details" });
      await expect(details.getByRole("heading", { name: "Design sync" })).toBeVisible();
      await expect.poll(async () => isFilled(await fit(page))).toBe(true);

      await page.keyboard.press("Escape");
      await expect(details).toHaveCount(0);
      await expect.poll(async () => isFilled(await fit(page))).toBe(true);
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the day is one column that fills the width, and the whole day is on the axis", async ({ page }) => {
    await open(page);
    const a = await fit(page);
    expect(a.columns).toBe(1);
    expect(a.last).toBe(23);
    expect(a.step).toBe(HOUR_PX);
    expectFilled(a);
  });

  test("the grid starts in the top 60% of the screen and the first hour row is within the first 700px", async ({ page }) => {
    await open(page, "?at=10:30");
    const top = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>("[data-calendar-grid]")!;
      const hour = [...frame.querySelectorAll<HTMLElement>("[data-hour]")].find((h) => h.getBoundingClientRect().top > frame.getBoundingClientRect().top + 60);
      return { frame: frame.getBoundingClientRect().top, hour: hour!.getBoundingClientRect().top };
    });
    expect(top.frame).toBeLessThan(812 * 0.6);
    expect(top.hour).toBeLessThan(700);
  });

  test("Next up is one line that opens the card, and the grid opens on now", async ({ page }) => {
    await open(page, "?at=10:30");
    const strip = page.getByRole("button", { name: /^Next up: Now: / });
    await expect(strip).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { name: "Next up" })).toBeHidden();
    await strip.focus();
    await page.keyboard.press("Enter");
    await expect(strip).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("heading", { name: "Next up" })).toBeVisible();
    // The hour of now is in view, not midnight.
    const scrolled = await page.evaluate(() => document.querySelector<HTMLElement>("[data-calendar-grid]")!.scrollTop);
    expect(scrolled).toBeGreaterThan(200);
  });

  test("the any-time row takes three rows and folds the rest under a + more button", async ({ page }) => {
    await open(page, "?at=10:30");
    const row = page.locator("[data-anytime] ul").first();
    await expect(row.locator("li[data-item]")).toHaveCount(2);
    const more = row.locator("button[aria-expanded]");
    await expect(more).toHaveText(/^\+\d+ more$/);
    await more.click();
    await expect(more).toHaveText("Show fewer");
    expect(await row.locator("li[data-item]").count()).toBeGreaterThan(2);
  });
});
