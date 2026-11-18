import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./session";

const WAITING_TASK = "/dev/detail?item=00000000-0000-4000-8000-000000000050";
const TASK_WITH_SUBTASKS = "/dev/detail?item=00000000-0000-4000-8000-000000000001";
const FRIDAYS_RUN = "/dev/detail?item=00000000-0000-4000-8000-000000000060~2026-10-09";

const BOOK_CLUB = "/dev/detail?item=00000000-0000-4000-8000-000000000080";
const BINS = "/dev/detail?item=00000000-0000-4000-8000-000000000081";
const RETRO = "/dev/detail?item=00000000-0000-4000-8000-000000000082";

const details = (page: Page) => page.getByRole("complementary", { name: "Details" });
// The date row's button reads the day in a few characters, and its name starts "Planned for".
const planned = (page: Page) => details(page).getByRole("button", { name: /^Planned for/ });
const timeGroup = (page: Page) => details(page).getByRole("group", { name: "Time" });
const anyTime = (page: Page) => timeGroup(page).getByRole("switch", { name: "Any time" });
const repeatRow = (page: Page) => details(page).getByRole("button", { name: /^Repeat:/ });
// The repeat editor is folded under its row until the row is pressed.
const openRepeat = async (page: Page) => {
  if ((await repeatRow(page).getAttribute("aria-expanded")) !== "true") await repeatRow(page).click();
};
const status = (page: Page, text: string | RegExp) => details(page).getByRole("status").filter({ hasText: text });

test("detail: a waiting task is planned for today, timed, and taken off its day again", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  await expect(planned(page)).toHaveText("No day");
  await expect(timeGroup(page)).toHaveCount(0);

  const planFor = planned(page);
  await planFor.click();
  await expect(details(page).getByRole("button", { name: "Today" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(planFor).toBeFocused();
  await expect(details(page).getByRole("button", { name: "Today" })).toHaveCount(0);

  await planFor.click();
  await details(page).getByRole("button", { name: "Today" }).click();
  await expect(status(page, "Planned for today.")).toBeVisible();
  const moveTo = planned(page);
  await expect(moveTo).toBeFocused();

  // With no time the fields stay folded; turning Any time off brings them and puts focus in the first.
  const time = timeGroup(page);
  await expect(time.getByLabel("Starts at")).toHaveCount(0);
  await expect(anyTime(page)).toHaveAttribute("aria-checked", "true");
  await anyTime(page).click();
  await expect(time.getByLabel("Starts at")).toBeFocused();
  await time.getByLabel("Starts at").fill("1430");
  await time.getByLabel("Starts at").press("Enter");
  await expect(status(page, "At 14:30 now.")).toBeVisible();
  await expect(time.getByLabel("Starts at")).toHaveValue("14:30");
  await expect(time.getByLabel("Ends at")).toHaveValue("15:00");

  await anyTime(page).click();
  await expect(status(page, "At any time of day now.")).toBeVisible();
  await expect(time.getByLabel("Starts at")).toHaveCount(0);

  await moveTo.click();
  await expect(details(page).getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
  await details(page).getByRole("button", { name: "No day" }).click();
  await expect(status(page, "It has no day now.")).toBeVisible();
  await expect(planned(page)).toHaveText("No day");
  await expect(planFor).toBeFocused();
  await expect(timeGroup(page)).toHaveCount(0);
});

test("detail: another day is picked from the date field", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  await planned(page).click();
  const plan = details(page).getByRole("button", { name: "Plan", exact: true });
  await expect(plan).toBeDisabled();
  await details(page).getByLabel("Another day").fill("2026-12-25");
  await plan.click();
  await expect(status(page, "Planned for Friday 25 December.")).toBeVisible();
  await expect(planned(page)).toHaveText("Fri 25 Dec");
});

test("detail: a day past 2200 is refused and the task keeps waiting", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  await planned(page).click();
  const another = details(page).getByLabel("Another day");
  await another.fill("9999-12-31");
  await details(page).getByRole("button", { name: "Plan", exact: true }).click();
  expect(await another.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  await expect(planned(page)).toHaveText("No day");
});

test("detail: a failed plan says so and leaves it waiting", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  await page.getByLabel("Make every save fail").check();
  await planned(page).click();
  await details(page).getByRole("button", { name: "Tomorrow" }).click();
  await expect(status(page, "That change did not save. Try again.")).toBeVisible();
  await expect(planned(page)).toHaveText("No day");
  await expect(planned(page)).toBeFocused();
});

test("detail: making a waiting task an event points at When, and a parent cannot be one", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  const type = details(page).getByLabel("Type");
  await type.selectOption("event");
  await expect(status(page, "An event needs a day and a time. Plan it under When.")).toBeVisible();
  await expect(planned(page)).toBeFocused();
  await expect(type).toHaveValue("event");

  await planned(page).click();
  await details(page).getByRole("button", { name: "Today" }).click();
  await type.selectOption("checklist");
  await type.selectOption("event");
  await expect(status(page, "An event needs a time. Add one under Time.")).toBeVisible();
  await expect(timeGroup(page).getByLabel("Starts at")).toBeFocused();

  await page.getByRole("link", { name: "Task with subtasks, some done" }).click();
  await expect(details(page).getByRole("textbox", { name: "Title" })).toHaveValue("Plan the Lisbon trip");
  await details(page).getByLabel("Type").selectOption("event");
  await expect(status(page, "Something with subtasks cannot be an event.")).toBeVisible();
  await expect(details(page).getByLabel("Type")).toHaveValue("task");
});

test("detail: a note and a subtask keep their type", async ({ page }) => {
  for (const id of ["20", "4"]) {
    await page.goto(`/dev/detail?item=00000000-0000-4000-8000-0000000000${id.padStart(2, "0")}`);
    await hydrated(page);
    await expect(details(page).getByText("Type: ")).toBeAttached();
    await expect(details(page).getByLabel("Type")).toHaveCount(0);
  }
});

test("detail: a due date is set and cleared", async ({ page }) => {
  await page.goto(TASK_WITH_SUBTASKS);
  await hydrated(page);
  const due = details(page).getByLabel("Due by", { exact: true });
  await expect(due).toHaveValue("2026-10-12");
  await due.fill("2026-10-20");
  await due.press("Enter");
  await expect(status(page, "Due Tuesday 20 October.")).toBeVisible();

  await details(page).getByRole("button", { name: "No due date" }).click();
  await expect(status(page, "No due date now.")).toBeVisible();
  // With no date the row folds back into "Add due date", and asking for it again brings back an empty field.
  await expect(due).toHaveCount(0);
  await details(page).getByRole("button", { name: "Add due date" }).click();
  await expect(details(page).getByLabel("Due by")).toHaveValue("");
  await expect(details(page).getByLabel("Due by")).toBeFocused();
  await expect(details(page).getByRole("button", { name: "No due date" })).toHaveCount(0);
});

test("detail: turning on Repeat for a waiting task says it starts today, and who ticks it done", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  await openRepeat(page);
  await expect(details(page).getByLabel("Repeat", { exact: true })).toBeFocused();
  await details(page).getByLabel("Repeat", { exact: true }).selectOption("daily");
  await expect(status(page, "Repeats every day from today.")).toBeVisible();
  await expect(details(page).getByLabel("First day")).toBeVisible();
  await expect(repeatRow(page)).toHaveText("Every day");
  await expect(details(page).getByText("Each time is ticked done on its own day")).toBeVisible();
  await expect(details(page).getByRole("checkbox", { name: /^Done:/ })).toHaveCount(0);
});

test("detail: one occurrence moves on its own with This one, and All of them keeps First day", async ({ page }) => {
  await page.goto(FRIDAYS_RUN);
  await hydrated(page);
  await planned(page).click();
  await expect(details(page).getByRole("button", { name: "No day" })).toHaveCount(0);
  // The harness reads the real clock, and the app says "today" or "tomorrow" for those two days, so the target is far off.
  await details(page).getByLabel("Another day").fill("2099-06-10");
  await details(page).getByRole("button", { name: "Move", exact: true }).click();
  await expect(status(page, "This one moved to Wednesday 10 June.")).toBeVisible();
  await expect(planned(page)).toHaveText("Wed 10 Jun 2099");

  await details(page).getByText("All of them").click();
  await expect(planned(page)).toHaveCount(0);
  await expect(details(page).getByLabel("First day")).toHaveValue("2026-10-05");
});

const summary = (page: Page) => repeatRow(page);

test("detail: a captured rule the menu cannot name opens in the editor and is edited in place", async ({ page }) => {
  await page.goto(BINS);
  await hydrated(page);
  await openRepeat(page);
  await expect(details(page).getByLabel("Repeat", { exact: true })).toHaveValue("custom");
  await expect(summary(page)).toHaveText("Every 3 weeks on Mon, Wed, Fri");
  const every = details(page).getByLabel("Every", { exact: true });
  await expect(every).toHaveValue("3");
  await expect(details(page).getByLabel("Days, weeks, months or years")).toHaveValue("weekly");
  const days = details(page).getByRole("group", { name: "On" });
  await expect(days.getByRole("button", { pressed: true }).locator("span[aria-hidden]")).toHaveText(["Mon", "Wed", "Fri"]);

  await days.getByRole("button", { name: "Wednesday" }).click();
  await expect(summary(page)).toHaveText("Every 3 weeks on Monday and Friday");
  // The toggles are plain buttons, so the keyboard reaches and presses them.
  await days.getByRole("button", { name: "Thursday" }).focus();
  await page.keyboard.press("Space");
  await expect(summary(page)).toHaveText("Every 3 weeks on Mon, Thu, Fri");

  await every.fill("2");
  await every.press("Enter");
  await expect(summary(page)).toHaveText("Every 2 weeks on Mon, Thu, Fri");
  // A number that is no interval goes back to the saved one.
  await every.fill("0");
  await every.blur();
  await expect(every).toHaveValue("2");

  await details(page).getByLabel("Ends", { exact: true }).selectOption("count");
  await expect(summary(page)).toHaveText("Every 2 weeks on Mon, Thu, Fri, 10 times");
  await expect(details(page).getByLabel("First day")).toHaveValue("2026-10-05");

  // Down to its own weekday it is the menu's "Every 2 weeks", but the editor stays open while it is being used.
  await days.getByRole("button", { name: "Thursday" }).click();
  await days.getByRole("button", { name: "Friday" }).click();
  await expect(summary(page)).toHaveText("Every 2 weeks on Monday, 10 times");
  await expect(days.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-disabled", "true");
  await days.getByRole("button", { name: "Monday" }).click({ force: true });
  await expect(days.getByRole("button", { pressed: true }).locator("span[aria-hidden]")).toHaveText(["Mon"]);
  await expect(details(page).getByLabel("Repeat", { exact: true })).toHaveValue("custom");
});

test("detail: Custom opens the editor on a monthly repeat, which can fall on a weekday by its place", async ({ page }) => {
  await page.goto(BOOK_CLUB);
  await hydrated(page);
  await openRepeat(page);
  const repeat = details(page).getByLabel("Repeat", { exact: true });
  await expect(repeat).toHaveValue("monthly");
  await expect(details(page).getByLabel("Every", { exact: true })).toHaveCount(0);

  await repeat.selectOption("custom");
  await expect(details(page).getByLabel("Every", { exact: true })).toHaveValue("1");
  const on = details(page).getByLabel("On", { exact: true });
  await expect(on.locator("option")).toHaveText(["On day 13", "On the second Tuesday"]);
  await on.selectOption({ label: "On the second Tuesday" });
  await expect(summary(page)).toHaveText("Every second Tuesday of the month");

  await details(page).getByLabel("Every", { exact: true }).fill("3");
  await details(page).getByLabel("Every", { exact: true }).press("Enter");
  await expect(summary(page)).toHaveText("Every 3 months on the second Tuesday");
  await expect(details(page).getByLabel("Days, weeks, months or years").locator("option")).toHaveText(["days", "weeks", "months", "years"]);

  // Weeks start on its own weekday.
  await details(page).getByLabel("Days, weeks, months or years").selectOption("weekly");
  await expect(details(page).getByRole("group", { name: "On" }).getByRole("button", { pressed: true }).locator("span[aria-hidden]")).toHaveText(["Tue"]);
  await expect(summary(page)).toHaveText("Every 3 weeks on Tuesday");

  // A menu choice closes the editor again.
  await repeat.selectOption("yearly");
  await expect(summary(page)).toHaveText("Every year");
  await expect(details(page).getByLabel("Every", { exact: true })).toHaveCount(0);
});

test("detail: a stored last Friday of the month reads back in the editor", async ({ page }) => {
  await page.goto(RETRO);
  await hydrated(page);
  await openRepeat(page);
  await expect(summary(page)).toHaveText("Every last Friday of the month");
  const on = details(page).getByLabel("On", { exact: true });
  await expect(on.locator("option")).toHaveText(["On day 30", "On the last Friday"]);
  await expect(on).toHaveValue("-1FR");
  await on.selectOption("day");
  await expect(summary(page)).toHaveText("Every month. Months with no 30th are skipped.");
});

test("detail: Custom on a waiting task starts it repeating every week from today", async ({ page }) => {
  await page.goto(WAITING_TASK);
  await hydrated(page);
  await openRepeat(page);
  await details(page).getByLabel("Repeat", { exact: true }).selectOption("custom");
  await expect(status(page, /^Repeats every week on \w+ from today\.$/)).toBeVisible();
  await expect(details(page).getByRole("group", { name: "On" }).getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(details(page).getByLabel("Repeat", { exact: true })).toHaveValue("custom");
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
      // A click before React has hydrated the page opens nothing.
      await hydrated(page);
      await planned(page).click();
      await expect(details(page).getByRole("button", { name: "Today" })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target.join(" ")) }));
      expect(blocking).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant.viewport.width);
    });

    for (const [name, path] of [
      ["weekday toggles", BINS],
      ["place in the month", RETRO],
    ] as const) {
      test(`detail: the repeat editor (${name}) has no serious or critical axe violations and does not scroll sideways`, async ({ page }) => {
        await page.goto(path);
        await hydrated(page);
        await openRepeat(page);
        await expect(details(page).getByLabel("Every", { exact: true })).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        const blocking = violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target.join(" ")) }));
        expect(blocking).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant.viewport.width);
      });
    }
  });
}
