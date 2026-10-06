import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragTo(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = await from.boundingBox();
  if (!box) throw new Error("drag source is not on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("drop target is not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

const clockToMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
const minutesToClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

test.describe("score", () => {
  // Tall enough that the tray and the staves are both on screen, so the drag needs no autoscroll.
  test.use({ viewport: { width: 1280, height: 1200 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/score");
  });

  test("dragging a waiting item onto an area gives it a time there", async ({ page }) => {
    const score = page.getByRole("region", { name: "Score" });
    const chip = page.getByRole("region", { name: "Waiting for a time" }).getByRole("button", { name: /^Book the dentist, waiting/ });
    const home = await center(score.getByText("Home", { exact: true }));

    await dragTo(page, chip, { x: home.box.x + home.box.width + 160, y: home.y });

    await expect(score.getByRole("button", { name: /^Book the dentist, \d\d:\d\d to \d\d:\d\d, Home, planned$/ })).toBeVisible();
    await expect(chip).toHaveCount(0);
  });

  test("arrow keys move a focused beam a quarter hour", async ({ page }) => {
    const beam = page.getByRole("button", { name: /^Design sync, \d\d:\d\d to \d\d:\d\d, Work/ });
    const [, start, end] = (await beam.getAttribute("aria-label"))!.match(/(\d\d:\d\d) to (\d\d:\d\d)/)!;
    const later = (clock: string) => minutesToClock(clockToMinutes(clock) + 15);

    await beam.focus();
    await page.keyboard.press("ArrowRight");

    const moved = page.getByRole("button", { name: `Design sync, ${later(start)} to ${later(end)}, Work, planned` });
    await expect(moved).toBeVisible();
    await expect(moved).toBeFocused();
  });
});

test("week: dragging an item to another day plans it there", async ({ page }) => {
  await page.goto("/dev/week");
  const days = page.getByRole("region", { name: "Days" }).getByRole("region");
  await expect(days).toHaveCount(7);
  const item = page.getByRole("button", { name: /^Stretch, / });
  let from = -1;
  for (let i = 0; i < 7; i++) if ((await days.nth(i).getByRole("button", { name: /^Stretch, / }).count()) > 0) from = i;
  expect(from).toBeGreaterThanOrEqual(0);
  const target = days.nth((from + 2) % 7);

  await dragTo(page, item, (await center(target.getByRole("heading"))));

  await expect(target.getByRole("button", { name: /^Stretch, / })).toBeVisible();
  await expect(days.nth(from).getByRole("button", { name: /^Stretch, / })).toHaveCount(0);
});

test("detail: a new subtask can be renamed in place", async ({ page }) => {
  await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000050");
  const subtasks = page.getByRole("region", { name: "Subtasks" });

  await subtasks.getByLabel("Add a subtask").fill("Buy stamps");
  await subtasks.getByLabel("Add a subtask").press("Enter");
  const added = subtasks.getByRole("textbox", { name: "Subtask: Buy stamps", exact: true });
  await expect(added).toHaveValue("Buy stamps");

  await added.fill("Buy stamps and envelopes");
  await added.press("Enter");
  await expect(subtasks.getByRole("textbox", { name: "Subtask: Buy stamps and envelopes", exact: true })).toHaveValue(
    "Buy stamps and envelopes",
  );
});

test("notes: typing in the editor saves", async ({ page }) => {
  await page.goto("/dev/notes/00000000-0000-4000-8000-000000000020");
  const body = page.getByRole("textbox", { name: "Garden through the winter" });
  await body.getByText("Lift the dahlias").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" before November");

  await expect(body).toContainText("Lift the dahlias before November");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
});

test("settings: an area can be added and renamed", async ({ page }) => {
  await page.goto("/dev/settings");
  const areas = page.getByRole("region", { name: "Areas" });

  await areas.getByLabel("New area name").fill("Studio");
  await areas.getByRole("button", { name: "Add area" }).click();
  const studio = areas.getByRole("textbox", { name: "Rename Studio", exact: true });
  await expect(studio).toHaveValue("Studio");

  await studio.fill("Garden");
  await studio.press("Enter");
  await expect(areas.getByRole("textbox", { name: "Rename Garden", exact: true })).toHaveValue("Garden");
  await expect(areas.getByRole("listitem")).toHaveCount(5);
});
