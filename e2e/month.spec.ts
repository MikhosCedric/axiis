import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { signedIn } from "./session";

// The Month on the real signed-in route, as the in-memory account from src/lib/supabase/fake-account.ts.
// Its fixtures plan "Renew the lease" for 20 May 2099, due 1 June 2099, so these months never meet a real today.

const cell = (page: Page, name: RegExp) => page.getByRole("gridcell", { name });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`);
}

signedIn.describe("the Month", () => {
  signedIn.use({ timezoneId: "UTC" });

  signedIn("draws the month's weeks with weekday heads, days around it, and a planned item and a due date", async ({ page }) => {
    await page.goto("/month/2099-05");
    await expect(page.getByRole("heading", { level: 1, name: "May 2099" })).toBeVisible();
    const grid = page.getByRole("grid", { name: "May 2099" });
    await expect(grid.getByRole("columnheader")).toHaveText(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], { useInnerText: true });
    await expect(grid.getByRole("columnheader").first()).toHaveAccessibleName("Monday");
    // 1 May 2099 is a Friday, so the grid opens on Monday 27 April and runs five weeks to Sunday 31 May.
    await expect(grid.getByRole("gridcell")).toHaveCount(35);
    await expect(grid.getByRole("gridcell").first()).toHaveAccessibleName("Monday 27 April, nothing planned");
    await expect(grid.getByRole("gridcell").last()).toHaveAccessibleName("Sunday 31 May, nothing planned");
    await page.goto("/month/2099-08");
    // 1 August 2099 is a Saturday: 31 days need a sixth week.
    await expect(page.getByRole("gridcell")).toHaveCount(42);
    await page.goto("/month/2099-05");
    await expect(cell(page, /^Wednesday 20 May, 1 item$/)).toBeVisible();
    await expect(cell(page, /^Wednesday 20 May/).getByRole("button", { name: /^Renew the lease, any time/ })).toBeVisible();

    await page.goto("/month/2099-06");
    await expect(cell(page, /^Monday 1 June, 1 item$/).getByRole("button", { name: /Renew the lease.*due this day/ })).toBeVisible();
    await expect(page.getByText("1 due.")).toBeVisible();
  });

  signedIn("changes month with Previous and Next, the bracket keys and T, and G then M goes to it", async ({ page }) => {
    await page.goto("/month/2099-05");
    await page.getByRole("link", { name: /^Next month, June 2099/ }).click();
    await expect(page).toHaveURL("/month/2099-06");
    await expect(page.getByRole("heading", { level: 1, name: "June 2099" })).toBeVisible();
    await page.keyboard.press("[");
    await expect(page).toHaveURL("/month/2099-05");
    await expect(page.getByRole("heading", { level: 1, name: "May 2099" })).toBeVisible();
    await page.keyboard.press("]");
    await expect(page).toHaveURL("/month/2099-06");
    await expect(page.getByRole("heading", { level: 1, name: "June 2099" })).toBeVisible();
    await page.keyboard.press("t");
    await expect(page).toHaveURL("/month");
    await page.goto("/today");
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.keyboard.press("g");
    await page.keyboard.press("m");
    await expect(page).toHaveURL("/month");
  });

  signedIn("Jump to month opens a year of months: arrows and Enter go, a click goes, Escape closes and returns focus", async ({ page }) => {
    await page.goto("/month/2099-05");
    const jump = page.getByRole("button", { name: "Jump to month" });
    const picker = page.getByRole("dialog", { name: "Jump to month" });
    await jump.click();
    await expect(picker).toBeVisible();
    await expect(jump).toHaveAttribute("aria-expanded", "true");
    await expect(picker.getByRole("button", { name: "May 2099" })).toBeFocused();
    await expect(picker.getByRole("button", { name: "May 2099" })).toHaveAttribute("aria-current", "page");

    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(jump).toBeFocused();

    // Down a row of three, across into next year, then a year back with Page Up.
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(picker.getByText("2100", { exact: true })).toBeVisible();
    await expect(picker.getByRole("button", { name: "February 2100" })).toBeFocused();
    await page.keyboard.press("PageUp");
    await page.keyboard.press("ArrowRight");
    await expect(picker.getByRole("button", { name: "March 2099" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/month/2099-03");
    await expect(page.getByRole("heading", { level: 1, name: "March 2099" })).toBeVisible();

    await jump.click();
    await picker.getByRole("button", { name: "Next year, 2100" }).click();
    await picker.getByRole("button", { name: "November 2100" }).click();
    await expect(page).toHaveURL("/month/2100-11");
    await expect(picker).toBeHidden();
  });

  signedIn("marks this month in the picker, and on a phone fits it on screen with 44px months", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/month");
    await page.getByRole("button", { name: "Jump to month" }).click();
    const picker = page.getByRole("dialog", { name: "Jump to month" });
    const months = picker.getByRole("group", { name: /^Months of / }).getByRole("button");
    await expect(months).toHaveCount(12);
    await expect(picker.getByRole("button", { name: /, this month$/ })).toHaveAttribute("aria-current", "page");
    const box = (await picker.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - 16);
    for (const b of await months.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(b).toBeGreaterThanOrEqual(44);
    expect(await axe(page)).toEqual([]);
  });

  signedIn("moves focus through the grid with the arrows, Home, End and the page keys, and Enter opens the day", async ({ page }) => {
    await page.goto("/month/2099-05");
    const first = cell(page, /^Friday 1 May/);
    await expect(first).toHaveAttribute("tabindex", "0");
    await expect(page.getByRole("gridcell").and(page.locator("[tabindex='0']"))).toHaveCount(1);
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, /^Saturday 2 May/)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(cell(page, /^Saturday 9 May/)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(cell(page, /^Monday 4 May/)).toBeFocused();
    await page.keyboard.press("End");
    await expect(cell(page, /^Sunday 10 May/)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(cell(page, /^Sunday 3 May/)).toBeFocused();
    await expect(cell(page, /^Sunday 3 May/)).toHaveAttribute("tabindex", "0");
    await expect(first).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL("/month/2099-06");
    await expect(cell(page, /^Wednesday 3 June/)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/day/2099-06-03");
  });

  signedIn("a click opens a day, and an item opens in the detail panel", async ({ page }) => {
    await page.goto("/month/2099-05");
    await cell(page, /^Wednesday 20 May/).getByRole("button", { name: /^Renew the lease/ }).click();
    await expect(page).toHaveURL(/\/month\/2099-05\?item=/);
    await expect(page.getByRole("complementary", { name: "Details" })).toBeVisible();
    await expect(page).toHaveURL(/\/month\/2099-05/);
    await cell(page, /^Thursday 14 May/).click();
    await expect(page).toHaveURL("/day/2099-05-14");
  });

  signedIn("captures onto the day in focus, and a drag moves the item to another day", async ({ page }) => {
    await page.goto("/month/2099-08");
    await cell(page, /^Saturday 1 August/).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("textbox", { name: "Capture for Sunday 2 August" })).toBeVisible();
    await page.getByRole("textbox", { name: "Capture for Sunday 2 August" }).fill("Water the garden 7:30");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Planned for Sunday 2 August, 07:30.")).toBeVisible();
    const mark = cell(page, /^Sunday 2 August/).getByRole("button", { name: /^Water the garden, 07:30/ });
    await expect(mark).toBeVisible();

    const target = cell(page, /^Wednesday 12 August/);
    const from = (await mark.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByText("Water the garden is on Wednesday 12 August.")).toBeVisible();
    await page.reload();
    await expect(cell(page, /^Wednesday 12 August, 1 item$/).getByRole("button", { name: /^Water the garden, 07:30/ })).toBeVisible();
    await expect(cell(page, /^Sunday 2 August, nothing planned$/)).toBeVisible();
  });

  for (const path of ["/month/2026-13", "/month/abc", "/month/1969-12", "/month/2201-01"]) {
    signedIn(`${path} answers 404 with the not-found page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "There is nothing at this address." })).toBeVisible();
    });
  }

  for (const colorScheme of ["light", "dark"] as const) {
    signedIn(`has no serious or critical axe violations at 1440 in ${colorScheme}, with an item open`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/month/2099-05");
      expect(await axe(page)).toEqual([]);
      await cell(page, /^Wednesday 20 May/).getByRole("button", { name: /^Renew the lease/ }).click();
      await expect(page.getByRole("complementary", { name: "Details" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  signedIn("on a phone draws dots, lists the chosen day under the grid, and a second tap opens it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/month/2099-05");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const day = cell(page, /^Wednesday 20 May/);
    const box = (await day.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(day.getByRole("button", { name: /^Renew the lease/ })).toBeHidden();

    await day.click();
    await expect(page).toHaveURL("/month/2099-05");
    const list = page.getByRole("region", { name: "Wednesday 20 May" });
    await expect(list.getByRole("button", { name: /^Renew the lease/ })).toBeVisible();
    await expect(list.getByRole("link", { name: "Open the day" })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await day.click();
    await expect(page).toHaveURL("/day/2099-05-20");
  });
});
