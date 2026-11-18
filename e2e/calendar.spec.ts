import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// The calendar's time grid on its harness: a fixed week in the past (Monday 9 to Sunday 15 March 2026) in
// UTC, so today is never one of its days and nothing below depends on when the tests run.
const WEEK = "/dev/calendar?date=2026-03-11&tz=UTC";
/** What the grid is drawn at: the first hour of its visible range and how tall an hour is, read off the page. */
async function scale(page: Page) {
  return page.locator("[data-calendar-grid]").evaluate((el) => ({ from: Number((el as HTMLElement).dataset.from), hour: parseFloat(getComputedStyle(el).getPropertyValue("--hour")) }));
}
const MON = "2026-03-09";
const TUE = "2026-03-10";
const THU = "2026-03-12";
const SAT = "2026-03-14";
const SUN = "2026-03-15";

const column = (page: Page, day: string) => page.locator(`[data-day-col="${day}"]`);
const block = (page: Page, name: RegExp) => page.locator("[data-calendar-grid]").getByRole("button", { name });

/** A point in a day's column at a time of day. */
async function at(page: Page, day: string, minutes: number) {
  const box = await column(page, day).boundingBox();
  if (!box) throw new Error(`no column for ${day}`);
  const s = await scale(page);
  return { x: box.x + box.width / 2, y: box.y + ((minutes - s.from) * s.hour) / 60 };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, { escape = false } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (escape) await page.keyboard.press("Escape");
  await page.mouse.up();
}

async function middle(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function open(page: Page, url = WEEK) {
  await page.goto(url);
  await expect(page.locator("[data-calendar-grid]")).toBeVisible();
  // Drags aim at measured positions; a webfont landing later would move them.
  await page.evaluate(() => document.fonts.ready);
}

test.describe("calendar grid", () => {
  // Tall enough that 07:00 to 20:00 is on screen without scrolling the grid.
  test.use({ viewport: { width: 1280, height: 1100 } });

  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("draws the week as columns, with overlapping items side by side and an any-time row", async ({ page }) => {
    await expect(page.locator("[data-day-col]")).toHaveCount(7);
    await expect(page.getByRole("heading", { name: "Monday 9 March" })).toBeVisible();
    // Wednesday 09:00 to 10:30 holds three items that overlap: each gets its own share of the column.
    const boxes = await Promise.all(
      [/^Review pull requests /, /^Budget review /, /^Call the plumber /].map(async (name) => (await middle(block(page, name))).box),
    );
    const lefts = boxes.map((b) => Math.round(b.x));
    expect(new Set(lefts).size).toBe(3);
    for (const b of boxes) expect(b.width).toBeLessThan((await middle(column(page, "2026-03-11"))).box.width / 2);
    // A ten-minute item is still tall enough to read.
    expect((await middle(block(page, /^Take the bins out /))).box.height).toBeGreaterThanOrEqual(20);
    await expect(page.getByRole("list", { name: "Any time, Saturday 14 March" }).getByRole("button", { name: /^Clean the gutters, any time/ })).toBeVisible();
    // The item that runs past midnight is drawn on both of its days.
    await expect(page.locator(`[data-day-col="${SUN}"] [data-item]`).filter({ hasText: "Night train" })).toBeVisible();
  });

  test("a click on empty time opens capture on that slot, and what is typed lands there", async ({ page }) => {
    const spot = await at(page, THU, 11 * 60 + 5);
    await page.mouse.click(spot.x, spot.y);
    const dialog = page.getByRole("dialog", { name: "New item" });
    await expect(dialog).toContainText("Thursday 12 March");
    await expect(dialog).toContainText("11:00 to 11:30");
    const field = dialog.getByRole("textbox", { name: "What is it" });
    await expect(field).toBeFocused();
    // The field starts empty: the slot is held apart and applied when saving.
    await expect(field).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Add" })).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.type("Lunch with Ana");
    await expect(dialog.getByText(/11:00 to 11:30/).last()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(block(page, /^Lunch with Ana 11:00, to 11:30, Thursday 12 March, No area, planned/)).toBeVisible();
    await expect(page.locator("[data-calendar-status]")).toHaveText("Planned for Thursday 12 March, 11:00 to 11:30.");
  });

  test("a length typed in capture wins over the slot's", async ({ page }) => {
    const spot = await at(page, THU, 15 * 60 + 5);
    await page.mouse.click(spot.x, spot.y);
    const dialog = page.getByRole("dialog", { name: "New item" });
    await expect(dialog.getByRole("textbox", { name: "What is it" })).toBeFocused();
    await page.keyboard.type("Review 1h");
    await expect(dialog).toContainText("15:00 to 16:00");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(block(page, /^Review 15:00 to 16:00, Thursday 12 March/)).toBeVisible();
  });

  test("dragging over empty time draws the length first", async ({ page }) => {
    await drag(page, await at(page, SAT, 13 * 60 + 5), await at(page, SAT, 14 * 60 + 20));
    const dialog = page.getByRole("dialog", { name: "New item" });
    await expect(dialog).toContainText("13:00 to 14:30");
    await expect(dialog.getByRole("textbox")).toHaveValue("");
    await page.keyboard.type("Garden");
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(block(page, /^Garden 13:00 to 14:30, Saturday 14 March/)).toBeVisible();
  });

  test("Escape closes capture and adds nothing", async ({ page }) => {
    const spot = await at(page, THU, 11 * 60 + 5);
    await page.mouse.click(spot.x, spot.y);
    await expect(page.getByRole("dialog", { name: "New item" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "New item" })).toHaveCount(0);
    await expect(page.locator("[data-ghost]")).toHaveCount(0);
  });

  test("a block drags to another day and time, and Undo puts it back", async ({ page }) => {
    const call = block(page, /^Call the landlord 12:00, to 12:30, Tuesday 10 March, Home, planned/);
    const from = await middle(call);
    const to = await at(page, THU, 0);
    await drag(page, from, { x: to.x, y: from.y + (await scale(page)).hour });
    await expect(block(page, /^Call the landlord 13:00, to 13:30, Thursday 12 March/)).toBeVisible();
    await expect(call).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(call).toBeVisible();
  });

  test("Escape during a drag puts the block back and opens nothing", async ({ page }) => {
    const call = block(page, /^Call the landlord 12:00, to 12:30, Tuesday 10 March/);
    const from = await middle(call);
    const to = await at(page, THU, 15 * 60);
    await drag(page, from, to, { escape: true });
    await expect(call).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a block's bottom edge drags to change its length", async ({ page }) => {
    const notes = block(page, /^Ship the release notes 11:00 to 12:00, Friday 13 March/);
    const { box } = await middle(notes);
    await drag(page, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + box.width / 2, y: box.y + box.height + (await scale(page)).hour / 2 });
    await expect(block(page, /^Ship the release notes 11:00 to 12:30, Friday 13 March/)).toBeVisible();
  });

  test("an any-time item drags into the grid for a time, and back out of it", async ({ page }) => {
    const chip = block(page, /^Clean the gutters, any time, Saturday 14 March/);
    await drag(page, await middle(chip), await at(page, SAT, 15 * 60));
    const timed = block(page, /^Clean the gutters 15:00, to 15:30, Saturday 14 March/);
    await expect(timed).toBeVisible();
    const cell = await middle(page.locator(`[data-anytime="${SUN}"]`));
    await drag(page, await middle(timed), cell);
    await expect(block(page, /^Clean the gutters, any time, Sunday 15 March/)).toBeVisible();
  });

  test("the keyboard moves a block, changes its length and walks the grid", async ({ page }) => {
    await block(page, /^Design sync 13:00 to 14:00, Monday 9 March/).focus();
    await page.keyboard.press("Alt+ArrowDown");
    const moved = block(page, /^Design sync 13:15 to 14:15, Monday 9 March/);
    await expect(moved).toBeFocused();
    await page.keyboard.press("Shift+ArrowDown");
    await expect(block(page, /^Design sync 13:15 to 14:30, Monday 9 March/)).toBeFocused();
    await page.keyboard.press("Alt+ArrowRight");
    await expect(block(page, /^Design sync 13:15 to 14:30, Tuesday 10 March/)).toBeFocused();
    // Plain arrows move focus, not the block: up to what comes before it that day, then across to the nearest thing on Monday.
    await page.keyboard.press("ArrowUp");
    await expect(block(page, /^Call the landlord /)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(`[data-nav][data-day="${MON}"]:focus`)).toHaveCount(1);
    // Alt Home takes the time away.
    await block(page, /^Design sync /).focus();
    await page.keyboard.press("Alt+Home");
    await expect(block(page, /^Design sync, any time, Tuesday 10 March/)).toBeFocused();
  });

  test("the keyboard reaches empty time: the slot moves with the arrows and Enter opens capture there", async ({ page }) => {
    await page.locator(`[data-slot-cursor="${MON}"]`).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    const slot = page.locator(`[data-slot-cursor="${TUE}"]`);
    await expect(slot).toBeFocused();
    await expect(slot).toHaveAccessibleName("New item, Tuesday 10 March, 09:30");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "New item" });
    await expect(dialog.getByRole("textbox")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(slot).toBeFocused();
  });

  test("a click shows a block in brief: tick it done, edit it in the panel, delete it and undo", async ({ page }) => {
    const walk = block(page, /^Long walk 10:00 to 12:00, Saturday 14 March, Health, planned/);
    await walk.click();
    const peek = page.getByRole("dialog", { name: "Long walk" });
    await expect(peek).toContainText("Saturday 14 March, 10:00 to 12:00");
    await expect(peek).toContainText("Health");
    const tick = peek.getByRole("checkbox", { name: "Done: Long walk" });
    // The box itself is drawn as the glyph over it, so the press goes to its label.
    await peek.locator("label").click();
    await expect(tick).toBeChecked();
    await expect(page.locator('[data-item][data-state="done"]').filter({ hasText: "Long walk" })).toBeVisible();
    await peek.locator("label").click();
    await expect(tick).not.toBeChecked();
    await expect(walk).toBeVisible();

    await peek.getByRole("button", { name: "Edit" }).click();
    await expect(page).toHaveURL(/[?&]item=/);
    await expect(page.getByRole("heading", { name: "Long walk", level: 2 })).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/[?&]item=/);

    await walk.click();
    await page.getByRole("dialog", { name: "Long walk" }).getByRole("button", { name: "Delete" }).click();
    await expect(walk).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(walk).toBeVisible();
  });

  test("the tick inside a block marks it done", async ({ page }) => {
    await page.getByRole("button", { name: "Done: Dentist", exact: true }).click();
    const dentist = page.locator("[data-calendar-grid] [data-item]").filter({ hasText: "Dentist" });
    await expect(dentist).toHaveAttribute("data-state", "done");
    await expect(page.locator("[data-calendar-status]")).toHaveText("Dentist is done.");
  });

  test("double-click and Enter go straight to the detail panel", async ({ page }) => {
    await block(page, /^Long walk /).dblclick();
    await expect(page).toHaveURL(/[?&]item=/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goBack();
    await block(page, /^Dentist /).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Dentist", level: 2 })).toBeVisible();
  });

  test("the span control shows one day, three days or the week", async ({ page }) => {
    const span = page.getByRole("group", { name: "Span" });
    await span.getByRole("button", { name: "Day", exact: true }).click();
    await expect(page.locator("[data-day-col]")).toHaveCount(1);
    await span.getByRole("button", { name: "3 days" }).click();
    await expect(page.locator("[data-day-col]")).toHaveCount(3);
  });

  test("a save that fails puts the block back and says so", async ({ page }) => {
    await page.getByLabel("Make saves fail").check();
    const call = block(page, /^Call the landlord 12:00, to 12:30, Tuesday 10 March/);
    const from = await middle(call);
    await drag(page, from, { x: from.x, y: from.y + (await scale(page)).hour });
    await expect(page.locator("[data-calendar-status]")).toContainText("did not save");
    await expect(call).toBeVisible();
  });
});

test.describe("calendar grid, where it opens", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("a week that is not this one opens on the morning", async ({ page }) => {
    await open(page);
    // On the smart range's first hour (07:00, or earlier when something is planned before it), not at 01:00.
    const s = await scale(page);
    expect(s.from).toBeLessThanOrEqual(7 * 60);
    expect(await page.locator("[data-calendar-grid]").evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page.locator("[data-calendar-grid] [data-hour]").first()).toBeVisible();
    await expect(page.locator("[data-now]")).toHaveCount(0);
  });

  test("marks today and draws the now line at the time", async ({ page }) => {
    await open(page, "/dev/calendar?tz=UTC&at=13:20");
    await expect(page.locator('h3[aria-current="date"]')).toHaveCount(1);
    const now = page.locator("[data-now]");
    await expect(now).toHaveCount(1);
    const top = await now.evaluate((el) => parseFloat((el as HTMLElement).style.translate.split(" ")[1]));
    const s = await scale(page);
    expect(top).toBeCloseTo(((13 * 60 + 20 - s.from) * s.hour) / 60, 1);
    // It opens a little before now: 11:00 is at the top, unless the whole range fits and nothing scrolls.
    const scrolled = await page.locator("[data-calendar-grid]").evaluate((el) => el.scrollTop);
    const expected = Math.max(0, ((11 * 60 - s.from) * s.hour) / 60 + (s.from > 0 ? 28 : 0));
    const room = await page.locator("[data-calendar-grid]").evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(scrolled).toBeCloseTo(Math.min(expected, room), 0);
  });

  test("writes the hours on the 12-hour clock when that is the reader's", async ({ page, context }) => {
    await context.addCookies([{ name: "clock", value: "12", domain: "localhost", path: "/" }]);
    await open(page, "/dev/calendar?date=2026-03-11&tz=UTC");
    await expect(page.locator('[data-hour="9"]')).toHaveText(/^9\sAM$/);
    await expect(page.locator('[data-hour="13"]')).toHaveText(/^1\sPM$/);
  });
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("a long press picks a block up; a plain touch does not", async ({ page }) => {
    await open(page, "/dev/calendar?date=2026-03-10&tz=UTC&span=day");
    const call = block(page, /^Call the landlord 12:00/);
    const { x, y } = await middle(call);
    const touch = (type: string, dy: number) =>
      call.dispatchEvent(type, { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y + dy, bubbles: true });
    // A touch that travels at once is a scroll: nothing is held, nothing moves.
    await touch("pointerdown", 0);
    await page.evaluate(([cx, cy]) => window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, pointerType: "touch", clientX: cx, clientY: cy + 60 })), [x, y]);
    await page.evaluate(([cx, cy]) => window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, pointerType: "touch", clientX: cx, clientY: cy + 60 })), [x, y]);
    await expect(call).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Resting first picks it up.
    await touch("pointerdown", 0);
    await page.waitForTimeout(400);
    await page.evaluate(([cx, cy]) => window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, pointerType: "touch", clientX: cx, clientY: cy + 52 })), [x, y]);
    await expect(page.locator("[data-ghost]")).toHaveText("13:00 to 13:30");
    await page.evaluate(([cx, cy]) => window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, pointerType: "touch", clientX: cx, clientY: cy + 52 })), [x, y]);
    await expect(block(page, /^Call the landlord 13:00/)).toBeVisible();
  });
});

const VARIANTS = [
  { name: "light", colorScheme: "light", viewport: { width: 1280, height: 900 }, span: "week" },
  { name: "dark", colorScheme: "dark", viewport: { width: 1280, height: 900 }, span: "week" },
  { name: "375px", colorScheme: "light", viewport: { width: 375, height: 812 }, span: "3day" },
  { name: "375px dark, one day", colorScheme: "dark", viewport: { width: 375, height: 812 }, span: "day" },
] as const;

for (const variant of VARIANTS) {
  test.describe(`a11y ${variant.name}`, () => {
    test.use({ colorScheme: variant.colorScheme, viewport: variant.viewport });

    test("the grid and both of its popovers have no axe violations", async ({ page }) => {
      await open(page, `/dev/calendar?date=2026-03-11&tz=UTC&span=${variant.span}`);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect((await new AxeBuilder({ page }).withRules(["label-content-name-mismatch"]).analyze()).violations).toEqual([]);
      // Nothing is wider than the window: the grid scrolls inside itself.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await block(page, /^Review pull requests /).focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("dialog", { name: "Review pull requests" })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press("Escape");

      await page.locator('[data-slot-cursor="2026-03-11"]').focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "New item" })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  });
}
