import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { hydrated, signedIn } from "./session";

const PACK = "/dev/lists?item=f3000000-0000-4000-8000-000000000001";

const lines = (panel: Locator) => panel.getByRole("region", { name: "Subtasks" }).getByRole("listitem");
const names = (rows: Locator) => rows.evaluateAll((els) => els.map((el) => el.querySelector("[data-reorder-handle]")?.getAttribute("aria-label")));

async function noViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

async function drag(page: Page, handle: Locator, to: Locator, below: boolean) {
  // The panel slides in, so wait for the grip to hold still.
  await expect.poll(async () => JSON.stringify(await handle.boundingBox()), { intervals: [200, 200, 200] }).toBe(JSON.stringify(await (async () => { await page.waitForTimeout(250); return handle.boundingBox(); })()));
  const from = (await handle.boundingBox())!;
  const target = (await to.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 4, { steps: 2 });
  await page.mouse.move(from.x + from.width / 2, target.y + (below ? target.height - 3 : 3), { steps: 8 });
  return async () => page.mouse.up();
}

test.describe("manual order", () => {
  test("subtasks move by Alt with Up or Down from anywhere in the row, and the move is said aloud", async ({ page }) => {
    await page.goto(PACK);
    await hydrated(page);
    const panel = page.getByRole("complementary", { name: "Details" });
    const rows = lines(panel);
    await expect(rows).toHaveCount(3);
    expect(await names(rows)).toEqual(["Move Sunscreen", "Move Charger", "Move Walking boots"]);

    await panel.getByRole("checkbox", { name: "Sunscreen" }).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => names(rows)).toEqual(["Move Charger", "Move Sunscreen", "Move Walking boots"]);
    await expect(panel.getByText("Sunscreen moved to 2 of 3.")).toBeAttached();
    await expect(panel.getByRole("checkbox", { name: "Sunscreen" })).toBeFocused();

    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowDown");
    await expect(panel.getByText("Sunscreen is last already.")).toBeAttached();
    await expect.poll(() => names(rows)).toEqual(["Move Charger", "Move Walking boots", "Move Sunscreen"]);

    // The order is stored: the list loads it back after the save.
    await expect.poll(() => names(lines(page.getByRole("complementary", { name: "Details" })))).toEqual(["Move Charger", "Move Walking boots", "Move Sunscreen"]);
  });

  test("the grip takes plain Up and Down, and a drag moves a row, with no accent colour at rest", async ({ page }) => {
    await page.goto(PACK);
    await hydrated(page);
    const panel = page.getByRole("complementary", { name: "Details" });
    const rows = lines(panel);
    const grip = panel.getByRole("button", { name: "Move Walking boots" });
    await expect(grip).toHaveAccessibleDescription(/Up and Down move it/);
    await grip.focus();
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => names(rows)).toEqual(["Move Sunscreen", "Move Walking boots", "Move Charger"]);
    await expect(grip).toBeFocused();

    const rest = await rows.first().evaluate((el) => getComputedStyle(el).boxShadow);
    expect(rest).toBe("none");
    const release = await drag(page, panel.getByRole("button", { name: "Move Sunscreen" }), rows.nth(2), true);
    await expect(rows.nth(2)).toHaveAttribute("data-reorder-drop", "after");
    expect(await rows.nth(2).evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    await release();
    await expect.poll(() => names(rows)).toEqual(["Move Walking boots", "Move Charger", "Move Sunscreen"]);
    await noViolations(page);
  });

  test("Escape during a drag drops the row where it was", async ({ page }) => {
    await page.goto(PACK);
    await hydrated(page);
    const panel = page.getByRole("complementary", { name: "Details" });
    const rows = lines(panel);
    await expect(rows).toHaveCount(3);
    const release = await drag(page, panel.getByRole("button", { name: "Move Sunscreen" }), rows.nth(2), true);
    await expect(rows.first()).toHaveAttribute("data-reorder-lifted", "");
    await page.keyboard.press("Escape");
    await release();
    expect(await names(rows)).toEqual(["Move Sunscreen", "Move Charger", "Move Walking boots"]);
  });

  test("a failed save puts the lines back and says so", async ({ page }) => {
    await page.goto(PACK);
    await hydrated(page);
    await page.getByLabel("Make every save fail").check();
    const panel = page.getByRole("complementary", { name: "Details" });
    const rows = lines(panel);
    await panel.getByRole("checkbox", { name: "Sunscreen" }).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(panel.getByRole("status").filter({ hasText: "That change did not save. Try again." })).toBeVisible();
    await expect.poll(() => names(rows)).toEqual(["Move Sunscreen", "Move Charger", "Move Walking boots"]);
  });

  test("the lists on the Lists page move by keyboard and by the menu, open ones staying above done ones", async ({ page }) => {
    await page.goto("/dev/lists");
    await hydrated(page);
    const list = page.getByRole("list").first();
    const rows = list.getByRole("listitem");
    const order = () => rows.evaluateAll((els) => els.map((el) => el.querySelector("[data-reorder-handle]")?.getAttribute("aria-label")));
    expect((await order()).slice(0, 2)).toEqual(["Move Ideas for the garden", "Move Pack for the coast"]);

    await page.getByRole("button", { name: "Move Ideas for the garden" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await order()).slice(0, 2)).toEqual(["Move Pack for the coast", "Move Ideas for the garden"]);

    // The last open list cannot pass the done one below it.
    await page.getByRole("button", { name: "Move Weekly reset", exact: false }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByText(/is last already\./)).toBeAttached();
    expect((await order()).at(-1)).toBe("Move Move the flat");

    await noViolations(page);
  });
});

signedIn.describe("manual order, signed in", () => {
  signedIn("a list moves from the More menu, and the new order is there after a reload", async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "axiis-e2e-account", value: "busy", url: baseURL }]);
    await page.goto("/lists");
    await hydrated(page);
    const rows = page.locator("li:has([data-reorder-handle])");
    const order = () => rows.evaluateAll((els) => els.map((el) => el.querySelector("[data-reorder-handle]")?.getAttribute("aria-label")));
    const before = await order();
    expect(before.length).toBeGreaterThan(1);
    const second = before[1]!.replace(/^Move /, "");

    const row = rows.nth(1);
    await row.hover();
    await row.getByRole("button", { name: `More ${second}` }).click();
    await page.getByRole("menuitem", { name: "Move up" }).click();
    await expect.poll(order).toEqual([before[1], before[0], ...before.slice(2)]);

    await page.reload();
    await hydrated(page);
    expect(await order()).toEqual([before[1], before[0], ...before.slice(2)]);
    await noViolations(page);
  });
});
