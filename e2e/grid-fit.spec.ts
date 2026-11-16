import { expect, test, type Page } from "@playwright/test";

// How the time grid fits its window. A desktop window: the Day is one comfortable column beside a side column (not
// a bar the width of the window), the page does not scroll and the grid is its one scroll area, drawn over the
// hours that matter (07:00 to 22:00 unless something is planned outside) with Earlier and Later hours at its ends.
// The Week fills the width. A phone: the page scrolls as one, with the day heads sticky.

const HOUR_PX = 52;
const DAY_COLUMN_MAX = 760;

/** The hour labels as drawn, and how the columns sit in the grid's own scroller. */
async function fit(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-calendar-grid]")!;
    const hours = [...frame.querySelectorAll<HTMLElement>("[data-hour]")];
    const nums = hours.map((t) => Number(t.dataset.hour));
    const tops = hours.map((t) => t.getBoundingClientRect().top);
    const cols = [...frame.querySelectorAll<HTMLElement>("[data-day-col]")].map((c) => c.getBoundingClientRect());
    const edge = frame.getBoundingClientRect().left + frame.clientWidth;
    const box = frame.getBoundingClientRect();
    return {
      first: nums[0],
      last: nums[nums.length - 1],
      count: nums.length,
      step: tops.length > 1 ? tops[1] - tops[0] : 0,
      columns: cols.length,
      columnWidth: cols[0].width,
      frameWidth: box.width,
      frameBottom: box.bottom,
      gap: edge - cols[cols.length - 1].right,
      scrollsSideways: frame.scrollWidth > frame.clientWidth,
      pageScrolls: document.documentElement.scrollWidth > window.innerWidth,
      pageScrollsDown: document.documentElement.scrollHeight > window.innerHeight + 1,
      innerHeight: window.innerHeight,
    };
  });
}

async function open(page: Page, query = "?at=12:00", path = "/dev/day") {
  await page.goto(`${path}${query}`);
  await expect(page.locator("[data-calendar-grid]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The grid measures the window in a layout effect and settles a frame later.
  await expect.poll(async () => (await fit(page)).step).toBeGreaterThan(0);
}

/** The columns reach the grid's right edge (to the pixel) and nothing scrolls sideways. */
const isFilled = (a: Awaited<ReturnType<typeof fit>>) => !a.scrollsSideways && !a.pageScrolls && Math.abs(a.gap) < 1.5;

test.describe("on a desktop window, 1440 by 900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the Day column is capped and the page has a single vertical scroll area", async ({ page }) => {
    await open(page);
    await expect.poll(async () => (await fit(page)).pageScrollsDown).toBe(false);
    const a = await fit(page);
    expect(a.columns).toBe(1);
    expect(a.frameWidth).toBeLessThanOrEqual(DAY_COLUMN_MAX);
    expect(a.columnWidth).toBeLessThanOrEqual(DAY_COLUMN_MAX);
    expect(a.scrollsSideways).toBe(false);
    // The grid reaches the bottom of the window, and the page itself stays put.
    expect(a.frameBottom).toBeLessThanOrEqual(a.innerHeight);
    expect(a.frameBottom).toBeGreaterThan(a.innerHeight - 40);
    // The side column holds the Inbox, beside the grid rather than under it.
    const rail = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>("[data-calendar-grid]")!.getBoundingClientRect();
      const tray = document.querySelector<HTMLElement>("[data-drop='tray']")!.getBoundingClientRect();
      return { gridRight: grid.right, trayLeft: tray.left };
    });
    expect(rail.trayLeft).toBeGreaterThanOrEqual(rail.gridRight);
  });

  test("the head is one bar: Today and the steps, the title with its summary under it, capture, then the controls", async ({ page }) => {
    await open(page);
    const row = await page.evaluate(() => {
      const top = (el: Element | null) => el!.getBoundingClientRect().top;
      const mid = (el: Element | null) => {
        const r = el!.getBoundingClientRect();
        return r.top + r.height / 2;
      };
      const header = document.querySelector("header")!;
      return {
        today: mid(header.querySelector("nav a")),
        capture: mid(document.querySelector("#capture")),
        titleTop: top(document.querySelector("#day-title")),
        summaryTop: top(header.querySelector("[data-glance]")),
        headerBottom: header.getBoundingClientRect().bottom,
        gridTop: top(document.querySelector("[data-calendar-grid]")),
      };
    });
    expect(Math.abs(row.today - row.capture)).toBeLessThan(24);
    expect(row.summaryTop).toBeGreaterThan(row.titleTop);
    expect(row.gridTop - row.headerBottom).toBeLessThan(40);
  });

  test("the grid draws 07:00 to 22:00 by default, with Earlier and Later hours to open the rest", async ({ page }) => {
    await open(page, "?at=12:00&tray=empty");
    const a = await fit(page);
    // Labels run from 08:00 to 21:00 inside the range (its edges are not labelled), an hour apart, at least 44px each.
    expect(a.first).toBeLessThanOrEqual(8);
    expect(a.step).toBeGreaterThanOrEqual(44);
    const earlier = page.locator("[data-expand='earlier']");
    const later = page.locator("[data-expand='later']");
    if (a.first > 1) {
      await expect(earlier).toHaveText("Earlier hours");
      await earlier.click();
      await expect(earlier).toHaveText("Hide earlier hours");
      expect((await fit(page)).first).toBe(1);
      await earlier.click();
    }
    if (a.last < 23) {
      await expect(later).toHaveText("Later hours");
      await later.click();
      await expect(later).toHaveText("Hide later hours");
      expect((await fit(page)).last).toBe(23);
    }
  });

  test("the Week fills the width", async ({ page }) => {
    await open(page, "?date=2026-03-11&tz=UTC", "/dev/calendar");
    const a = await fit(page);
    expect(a.columns).toBe(7);
    expect(isFilled(a)).toBe(true);
    // The grid is fitted to the window under the head, with the Inbox tray below it (the harness adds its own padding).
    expect(a.frameBottom).toBeLessThan(a.innerHeight);
  });
});

for (const width of [1920, 1280]) {
  test.describe(`at ${width} wide`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the Day column stays at its width when the detail panel opens and closes", async ({ page }) => {
      await open(page);
      const closed = await fit(page);
      expect(closed.frameWidth).toBeLessThanOrEqual(DAY_COLUMN_MAX);
      expect(closed.scrollsSideways || closed.pageScrolls).toBe(false);

      const block = page.locator("[data-calendar-grid]").getByRole("button", { name: /^Design sync/ });
      await block.focus();
      await page.keyboard.press("Enter");
      const details = page.getByRole("complementary", { name: "Details" });
      await expect(details.getByRole("heading", { name: "Design sync" })).toBeVisible();
      await expect.poll(async () => (await fit(page)).pageScrolls).toBe(false);
      expect((await fit(page)).scrollsSideways).toBe(false);

      await page.keyboard.press("Escape");
      await expect(details).toHaveCount(0);
      await expect.poll(async () => (await fit(page)).frameWidth).toBeLessThanOrEqual(DAY_COLUMN_MAX);
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the day is one column that fills the width, and the hours keep their usual height", async ({ page }) => {
    await open(page);
    const a = await fit(page);
    expect(a.columns).toBe(1);
    expect(a.step).toBe(HOUR_PX);
    expect(isFilled(a)).toBe(true);
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

  test("the page scrolls as one: the grid has no scroll of its own and its day head sticks", async ({ page }) => {
    await open(page, "?at=10:30");
    const own = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>("[data-calendar-grid]")!;
      return { overflow: getComputedStyle(frame).overflowY, taller: frame.scrollHeight > frame.clientHeight + 1 };
    });
    expect(own.overflow).toBe("visible");
    expect(own.taller).toBe(false);
    await page.evaluate(() => window.scrollBy(0, 500));
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>("[data-head]")!.getBoundingClientRect().top)).toBeGreaterThan(40);
    expect(await page.evaluate(() => document.querySelector<HTMLElement>("[data-head]")!.getBoundingClientRect().top)).toBeLessThan(140);
  });

  test("Next up is one line that opens the card", async ({ page }) => {
    await open(page, "?at=10:30");
    const strip = page.getByRole("button", { name: /^Next up: Now: / });
    await expect(strip).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { name: "Next up" })).toBeHidden();
    await strip.focus();
    await page.keyboard.press("Enter");
    await expect(strip).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("heading", { name: "Next up" })).toBeVisible();
  });

  test("the any-time row takes three rows and folds the rest under a + more button", async ({ page }) => {
    await open(page, "?at=10:30");
    const row = page.locator("[data-anytime] ul").first();
    await expect(row.locator("li[data-item]:visible")).toHaveCount(2);
    const more = row.locator("button[aria-expanded]");
    await expect(more).toHaveText(/^\+\d+ more$/);
    await more.click();
    await expect(more).toHaveText("Show fewer");
    expect(await row.locator("li[data-item]:visible").count()).toBeGreaterThan(2);
  });
});
