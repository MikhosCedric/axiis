import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WAITING_TASK = "/dev/detail?item=00000000-0000-4000-8000-000000000050";
const TASK_WITH_SUBTASKS = "/dev/detail?item=00000000-0000-4000-8000-000000000001";
const FRIDAYS_RUN = "/dev/detail?item=00000000-0000-4000-8000-000000000060~2026-10-09";

const details = (page: Page) => page.getByRole("complementary", { name: "Details" });
const row = (page: Page, label: string) => details(page).locator("dt", { hasText: label }).locator("+ dd");
const status = (page: Page, text: string) => details(page).getByRole("status").filter({ hasText: text });

test("detail: a waiting task is planned for today, timed, and taken off its day again", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await expect(row(page, "When")).toContainText("No day yet, in the Inbox");
  await expect(details(page).getByRole("group", { name: "Time" })).toHaveCount(0);

  const planFor = details(page).getByRole("button", { name: "Plan for" });
  await planFor.click();
  await expect(details(page).getByRole("button", { name: "Today" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(planFor).toBeFocused();
  await expect(details(page).getByRole("button", { name: "Today" })).toHaveCount(0);

  await planFor.click();
  await details(page).getByRole("button", { name: "Today" }).click();
  await expect(status(page, "Planned for today.")).toBeVisible();
  const moveTo = details(page).getByRole("button", { name: "Move to" });
  await expect(moveTo).toBeFocused();

  const time = details(page).getByRole("group", { name: "Time" });
  await time.getByLabel("Starts at").fill("1430");
  await time.getByLabel("Starts at").press("Enter");
  await expect(status(page, "At 14:30 now.")).toBeVisible();
  await expect(row(page, "When")).toContainText("14:30 to 15:00");

  await details(page).getByRole("button", { name: "Any time", exact: true }).click();
  await expect(status(page, "At any time of day now.")).toBeVisible();
  await expect(row(page, "When")).not.toContainText("14:30");

  await moveTo.click();
  await expect(details(page).getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
  await details(page).getByRole("button", { name: "No day" }).click();
  await expect(status(page, "It has no day now.")).toBeVisible();
  await expect(row(page, "When")).toContainText("No day yet, in the Inbox");
  await expect(planFor).toBeFocused();
  await expect(details(page).getByRole("group", { name: "Time" })).toHaveCount(0);
});

test("detail: another day is picked from the date field", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await details(page).getByRole("button", { name: "Plan for" }).click();
  const plan = details(page).getByRole("button", { name: "Plan", exact: true });
  await expect(plan).toBeDisabled();
  await details(page).getByLabel("Another day").fill("2026-12-25");
  await plan.click();
  await expect(status(page, "Planned for Friday 25 December.")).toBeVisible();
  await expect(row(page, "When")).toContainText("Friday 25 December");
});

test("detail: a day past 2200 is refused and the task keeps waiting", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await details(page).getByRole("button", { name: "Plan for" }).click();
  const another = details(page).getByLabel("Another day");
  await another.fill("9999-12-31");
  await details(page).getByRole("button", { name: "Plan", exact: true }).click();
  expect(await another.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  await expect(row(page, "When")).toContainText("No day yet, in the Inbox");
});

test("detail: a failed plan says so and leaves it waiting", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await page.getByLabel("Make every save fail").check();
  await details(page).getByRole("button", { name: "Plan for" }).click();
  await details(page).getByRole("button", { name: "Tomorrow" }).click();
  await expect(status(page, "That change did not save. Try again.")).toBeVisible();
  await expect(row(page, "When")).toContainText("No day yet, in the Inbox");
  await expect(details(page).getByRole("button", { name: "Plan for" })).toBeFocused();
});

test("detail: making a waiting task an event points at When, and a parent cannot be one", async ({ page }) => {
  await page.goto(WAITING_TASK);
  const type = details(page).getByLabel("Type");
  await type.selectOption("event");
  await expect(status(page, "An event needs a day and a time. Plan it under When.")).toBeVisible();
  await expect(details(page).getByRole("button", { name: "Plan for" })).toBeFocused();
  await expect(type).toHaveValue("event");

  await details(page).getByRole("button", { name: "Plan for" }).click();
  await details(page).getByRole("button", { name: "Today" }).click();
  await type.selectOption("checklist");
  await type.selectOption("event");
  await expect(status(page, "An event needs a time. Add one under Time.")).toBeVisible();
  await expect(details(page).getByRole("group", { name: "Time" }).getByLabel("Starts at")).toBeFocused();

  await page.getByRole("link", { name: "Task with subtasks, some done" }).click();
  await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Plan the Lisbon trip");
  await details(page).getByLabel("Type").selectOption("event");
  await expect(status(page, "Something with subtasks cannot be an event.")).toBeVisible();
  await expect(details(page).getByLabel("Type")).toHaveValue("task");
});

test("detail: a note and a subtask keep their type", async ({ page }) => {
  for (const id of ["20", "4"]) {
    await page.goto(`/dev/detail?item=00000000-0000-4000-8000-0000000000${id.padStart(2, "0")}`);
    await expect(row(page, "Type")).toBeVisible();
    await expect(details(page).getByLabel("Type")).toHaveCount(0);
  }
});

test("detail: a due date is set and cleared", async ({ page }) => {
  await page.goto(TASK_WITH_SUBTASKS);
  const due = details(page).getByLabel("Due");
  await expect(due).toHaveValue("2026-10-12");
  await due.fill("2026-10-20");
  await due.press("Enter");
  await expect(status(page, "Due Tuesday 20 October.")).toBeVisible();

  await details(page).getByRole("button", { name: "No due date" }).click();
  await expect(status(page, "No due date now.")).toBeVisible();
  await expect(due).toHaveValue("");
  await expect(details(page).getByRole("button", { name: "No due date" })).toHaveCount(0);
});

test("detail: turning on Repeat for a waiting task says it starts today, and who ticks it done", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await details(page).getByLabel("Repeat").selectOption("daily");
  await expect(status(page, "Repeats every day from today.")).toBeVisible();
  await expect(row(page, "Starts")).toBeVisible();
  await expect(details(page).getByText("Each time is ticked done on its own day")).toBeVisible();
  await expect(details(page).getByRole("checkbox", { name: /^Done:/ })).toHaveCount(0);
});

test("detail: one occurrence moves on its own with This one, and All of them keeps First day", async ({ page }) => {
  await page.goto(FRIDAYS_RUN);
  await details(page).getByRole("button", { name: "Move to" }).click();
  await expect(details(page).getByRole("button", { name: "No day" })).toHaveCount(0);
  // The harness reads the real clock, and the app says "today" or "tomorrow" for those two days, so the target is far off.
  await details(page).getByLabel("Another day").fill("2099-06-10");
  await details(page).getByRole("button", { name: "Move", exact: true }).click();
  await expect(status(page, "This one moved to Wednesday 10 June.")).toBeVisible();
  await expect(row(page, "When")).toContainText("Wednesday 10 June");

  await details(page).getByText("All of them").click();
  await expect(details(page).getByRole("button", { name: "Move to" })).toHaveCount(0);
  await expect(details(page).getByLabel("First day")).toHaveValue("2026-10-05");
});

for (const variant of [
  { name: "light", colorScheme: "light", viewport: { width: 1280, height: 800 } },
  { name: "dark", colorScheme: "dark", viewport: { width: 1280, height: 800 } },
  { name: "phone", colorScheme: "light", viewport: { width: 375, height: 812 } },
] as const) {
  test.describe(variant.name, () => {
    test.use({ colorScheme: variant.colorScheme, viewport: variant.viewport });

    test("detail: the open plan choices, Type and Due have no serious or critical axe violations", async ({ page }) => {
      await page.goto(WAITING_TASK);
      await details(page).getByRole("button", { name: "Plan for" }).click();
      await expect(details(page).getByRole("button", { name: "Today" })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target.join(" ")) }));
      expect(blocking).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant.viewport.width);
    });
  });
}
