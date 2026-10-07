import { expect, test, type Page } from "@playwright/test";

const HOUR_PX = 76;

/** The hour axis as drawn, and how the staves sit in their scroller. */
async function axis(page: Page) {
  return page.evaluate(() => {
    const hours = [...document.querySelectorAll<HTMLElement>("[data-hour]")].map((t) => Number(t.dataset.hour));
    const label = document.querySelector<HTMLElement>("[data-staff-label]")!;
    const body = label.nextElementSibling!.getBoundingClientRect();
    const scroller = label.closest<HTMLElement>(".overflow-x-auto")!;
    return {
      first: hours[0],
      last: hours[hours.length - 1],
      count: hours.length,
      bodyWidth: body.width,
      gap: scroller.getBoundingClientRect().right - body.right,
      scrolls: scroller.scrollWidth > scroller.clientWidth,
    };
  });
}

/** The staves reach the scroller's right edge, short of one hour, unless the whole day is already drawn. */
function expectFilled(a: Awaited<ReturnType<typeof axis>>) {
  expect(a.scrolls).toBe(false);
  expect(a.bodyWidth).toBe(a.count * HOUR_PX);
  if (a.count < 24) {
    expect(a.gap).toBeGreaterThanOrEqual(0);
    expect(a.gap).toBeLessThan(HOUR_PX);
  }
}

test.describe("on a wide window", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("the Score's hour axis runs past 19:00 and fills the width with no empty strip", async ({ page }) => {
    await page.goto("/dev/score");
    await expect(page.locator("[data-hour]").first()).toBeVisible();
    await expect.poll(async () => (await axis(page)).last).toBeGreaterThan(19);
    const a = await axis(page);
    expect(a.first).toBeLessThanOrEqual(7);
    expectFilled(a);
  });
});

for (const width of [1920, 1280]) {
  test.describe(`at ${width} wide`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the axis refills when the detail panel opens and closes", async ({ page }) => {
      await page.goto("/dev/score");
      await expect(page.locator("[data-hour]").first()).toBeVisible();
      const closed = await axis(page);
      // At 1920 the fixture's day always fits with the panel shut; at 1280 it always scrolls.
      if (width === 1920) expectFilled(closed);
      else expect(closed.scrolls).toBe(true);

      await page.getByRole("button", { name: /^Design sync, / }).click();
      const details = page.getByRole("complementary", { name: "Details" });
      await expect(details.getByRole("heading", { name: "Design sync" })).toBeVisible();
      await expect.poll(async () => {
        const a = await axis(page);
        return a.scrolls || a.count < closed.count;
      }).toBe(true);
      // With the panel open, a day that starts before 04:00 is too long to fit, so it scrolls instead.
      const open = await axis(page);
      if (!open.scrolls) expectFilled(open);

      await page.keyboard.press("Escape");
      await expect(details).toHaveCount(0);
      await expect.poll(async () => (await axis(page)).count).toBe(closed.count);
      expect(await axis(page)).toEqual(closed);
    });
  });
}

test.describe("while dragging", () => {
  test.use({ viewport: { width: 1920, height: 900 } });

  test("a resize mid-drag leaves the axis alone until the beam is let go", async ({ page }) => {
    await page.goto("/dev/score");
    const beam = page.getByRole("button", { name: /^Design sync, / });
    await expect.poll(async () => (await axis(page)).scrolls).toBe(false);
    const before = await axis(page);
    const noon = () => page.locator('[data-hour="12"]').evaluate((el) => el.getBoundingClientRect().left);
    const x = await noon();

    const box = (await beam.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 4 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.mouse.move(box.x + 44, box.y + box.height / 2);
    expect((await axis(page)).count).toBe(before.count);
    expect(await noon()).toBe(x);

    await page.mouse.up();
    await expect.poll(async () => (await axis(page)).count).toBeLessThan(before.count);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the axis keeps its default hours and scrolls sideways", async ({ page }) => {
    await page.goto("/dev/score");
    await expect(page.locator("[data-hour]").first()).toBeAttached();
    const a = await axis(page);
    expect(a.scrolls).toBe(true);
    expect(a.first).toBeLessThanOrEqual(7);
    expect(a.last).toBeGreaterThanOrEqual(19);
    expect(a.bodyWidth).toBe(a.count * HOUR_PX);
  });
});
