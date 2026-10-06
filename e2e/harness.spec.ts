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
    const chip = page.getByRole("region", { name: "Waiting" }).getByRole("button", { name: /^Book the dentist, waiting/ });
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

    // The fixture fixes this event at 13:00, so when the suite runs near then the moved beam covers now.
    const moved = page.getByRole("button", {
      name: new RegExp(`^Design sync, ${later(start)} to ${later(end)}, Work, (planned|happening now)$`),
    });
    await expect(moved).toBeVisible();
    await expect(moved).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: /^Design sync, / })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Same time/ })).toHaveCount(0);
  });

  test("timing one day of a repeating item offers the same time every day", async ({ page }) => {
    await page.getByRole("button", { name: "Take vitamins, any time, planned, repeats" }).focus();
    await page.keyboard.press("ArrowDown");

    const status = page.getByRole("status").filter({ hasText: /^Take vitamins, \d\d:\d\d to \d\d:\d\d, No area\./ });
    await expect(status).toBeVisible();
    const clock = (await status.textContent())!.match(/(\d\d:\d\d) to/)![1];
    await status.getByRole("button", { name: "Same time every day" }).click();

    await expect(page.getByRole("status").filter({ hasText: `Take vitamins is at ${clock} every day.` })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Same time/ })).toHaveCount(0);
  });

  test("when the same time for every day does not save, it says so", async ({ page }) => {
    await page.getByRole("button", { name: "Take vitamins, any time, planned, repeats" }).focus();
    await page.keyboard.press("ArrowDown");
    const offer = page.getByRole("button", { name: "Same time every day" });
    await expect(offer).toBeVisible();

    await page.getByLabel("Make saves fail").check();
    await offer.click();

    await expect(page.getByRole("status").filter({ hasText: "That change did not save. Try again." })).toBeVisible();
  });

  test("dragging a repeating item from any time onto an area offers it too", async ({ page }) => {
    const score = page.getByRole("region", { name: "Score" });
    const chip = page.getByRole("button", { name: "Take vitamins, any time, planned, repeats" });
    const home = await center(score.getByText("Home", { exact: true }));

    await dragTo(page, chip, { x: home.box.x + home.box.width + 160, y: home.y });

    await expect(score.getByRole("button", { name: /^Take vitamins, \d\d:\d\d to \d\d:\d\d, Home, planned, repeats$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Same time every day" })).toBeVisible();
  });
});

for (const view of ["", "&view=list"]) {
  test(`score${view}: an empty tray does not claim everything has a time while some are at any time`, async ({ page }) => {
    await page.goto(`/dev/score?tray=empty${view}`);
    await expect(page.getByText(/Take vitamins/).first()).toBeVisible();
    await expect(page.getByText("Nothing is waiting. What you capture lands here first.")).toBeVisible();
    await expect(page.getByText(/Everything has a/)).toHaveCount(0);
  });
}

test("detail: a time set for all of them moves the series and leaves other changed days alone", async ({ page }) => {
  const when = (label: string) => page.getByRole("complementary").locator("dt", { hasText: label }).locator("+ dd");
  await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000061");
  const wednesday = await when("When").textContent();

  await page.getByRole("link", { name: "Repeating: Friday's run, not touched yet" }).click();
  await expect(page.getByText("Repeats. This is the one for Friday 9 October.")).toBeVisible();
  await page.getByText("All of them").click();
  const time = page.getByRole("group", { name: "Time" });
  await time.getByLabel("Starts at").fill("08:00");
  await time.getByLabel("Ends at").fill("08:30");
  await time.getByLabel("Ends at").press("Enter");
  await expect(when("When")).toHaveText("Friday 9 October, 08:00 to 08:30");

  await page.getByRole("link", { name: "Repeating: the run series itself" }).click();
  await expect(when("Starts")).toHaveText("Monday 5 October, 08:00 to 08:30");
  await page.getByRole("link", { name: "Repeating: Wednesday's run, renamed and done" }).click();
  await expect(when("When")).toHaveText(wednesday!);
});

test("detail: all of them can go back to any time and start on another day", async ({ page }) => {
  const when = (label: string) => page.getByRole("complementary").locator("dt", { hasText: label }).locator("+ dd");
  await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000061");
  const wednesday = await when("When").textContent();
  await page.getByRole("link", { name: "Repeating: Friday's run, not touched yet" }).click();
  await expect(page.getByText("Repeats. This is the one for Friday 9 October.")).toBeVisible();
  await expect(page.getByLabel("First day")).toHaveCount(0);

  await page.getByText("All of them").click();
  await page.getByRole("button", { name: "Any time" }).click();
  await expect(page.getByRole("status").filter({ hasText: "All of them are at any time of day now." })).toBeVisible();
  await expect(when("When")).toHaveText("Friday 9 October");

  const first = page.getByLabel("First day");
  await expect(first).toHaveValue("2026-10-05");
  await first.fill("2026-10-07");
  await first.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "It starts on Wednesday 7 October now." })).toBeVisible();

  await page.getByRole("link", { name: "Repeating: the run series itself" }).click();
  await expect(when("Starts")).toHaveText("Wednesday 7 October");
  await page.getByRole("link", { name: "Repeating: Wednesday's run, renamed and done" }).click();
  await expect(when("When")).toHaveText(wednesday!);
});

test("detail: the series itself has a Time and a First day row", async ({ page }) => {
  const when = (label: string) => page.getByRole("complementary").locator("dt", { hasText: label }).locator("+ dd");
  await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000060");
  await expect(page.getByText("This one")).toHaveCount(0);
  const time = page.getByRole("group", { name: "Time" });
  await expect(time.getByLabel("Starts at")).toHaveValue("06:30");
  await time.getByLabel("Starts at").fill("0700");
  await time.getByLabel("Starts at").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "All of them are at 07:00 now." })).toBeVisible();
  await expect(when("Starts")).toHaveText("Monday 5 October, 07:00 to 07:15");

  const first = page.getByLabel("First day");
  await expect(first).toHaveValue("2026-10-05");
  await first.fill("2026-10-07");
  await first.press("Enter");
  await expect(when("Starts")).toHaveText("Wednesday 7 October, 07:00 to 07:15");

  await page.getByRole("button", { name: "Any time" }).click();
  await expect(when("Starts")).toHaveText("Wednesday 7 October");
});

test("detail: a skipped day is listed on the series and can be restored", async ({ page }) => {
  const skipped = page.getByRole("region", { name: "Skipped dates" });
  await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000060~2026-10-09");
  await expect(page.getByText("Repeats. This is the one for Friday 9 October.")).toBeVisible();
  await expect(skipped).toHaveCount(0);

  await page.getByRole("link", { name: "Repeating: the run series itself" }).click();
  await expect(skipped.getByRole("listitem")).toHaveText(["Friday 16 OctoberRestore", "Monday 4 January 2027Restore"]);
  await skipped.getByRole("button", { name: "Restore Friday 16 October" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Friday 16 October is back." })).toBeVisible();
  await expect(skipped.getByRole("listitem")).toHaveText(["Monday 4 January 2027Restore"]);

  await page.getByRole("link", { name: "Repeating: a skipped run in January" }).click();
  await expect(page.getByText("Repeats. This is the one for Monday 4 January 2027, skipped.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip this one" })).toHaveCount(0);
  await page.getByRole("button", { name: "Restore this one" }).click();
  await expect(page.getByText("Repeats. This is the one for Monday 4 January 2027.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip this one" })).toBeVisible();

  await page.getByRole("link", { name: "Repeating: the run series itself" }).click();
  await expect(page.getByText("Every week on Monday, Wednesday and Friday")).toBeVisible();
  await expect(skipped).toHaveCount(0);
});

test("detail: times are typed and shown on the 24-hour clock, and an unreadable one is not saved", async ({ page }) => {
  // The When row also holds the Move to button, so read only the words it shows.
  const when = (label: string) => page.getByRole("complementary").locator("dt", { hasText: label }).locator("+ dd > span").first();
  await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000070~2026-10-11");
  const time = page.getByRole("group", { name: "Time" });
  const start = time.getByLabel("Starts at");
  const end = time.getByLabel("Ends at");

  await start.fill("1430");
  await end.fill("15.15");
  await end.press("Enter");
  await expect(start).toHaveValue("14:30");
  await expect(end).toHaveValue("15:15");
  await expect(when("When")).toHaveText("Sunday 11 October, 14:30 to 15:15");
  await start.fill("930");
  await start.press("Enter");
  await expect(start).toHaveValue("09:30");
  await expect(when("When")).toHaveText("Sunday 11 October, 09:30 to 15:15");

  await end.fill("3pm");
  await end.press("Enter");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("That time could not be read. 24-hour clock, like 14:30 or 1430.")).toBeVisible();
  await expect(when("When")).toHaveText("Sunday 11 October, 09:30 to 15:15");
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

test("notes: tabbing into the body shows a focus rule beside it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dev/notes/00000000-0000-4000-8000-000000000020");
  const body = page.getByRole("textbox", { name: "Garden through the winter" });
  const rule = () =>
    body.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderLeftWidth, color: s.borderLeftColor, left: el.getBoundingClientRect().left };
    });
  const resting = await rule();
  expect(resting.color).toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("textbox", { name: "Title" }).focus();
  for (let i = 0; i < 12 && !(await body.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(body).toBeFocused();
  const focused = await rule();
  expect(focused.width).toBe("2px");
  expect(focused.color).not.toBe(resting.color);
  expect(focused.left).toBeGreaterThanOrEqual(0);
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

test.describe("tags", () => {
  test("the index lists tags with open counts and opens a tag's page", async ({ page }) => {
    await page.goto("/dev/tags");
    await expect(page.getByRole("heading", { level: 1, name: "Tags" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Deep work\s*1 open$/ })).toBeVisible();

    await page.getByRole("link", { name: /^errands/ }).click();
    await expect(page).toHaveURL(/\/dev\/tags\/errands$/);
    await expect(page.getByRole("heading", { level: 1, name: "errands" })).toBeVisible();
    await expect(page.getByText("4 open, 1 done.")).toBeVisible();
  });

  test("a tag whose name has a space opens from its link", async ({ page }) => {
    await page.goto("/dev/tags");
    await page.getByRole("link", { name: /^Deep work/ }).click();
    await expect(page).toHaveURL(/\/dev\/tags\/Deep%20work$/);
    await expect(page.getByRole("heading", { level: 1, name: "Deep work" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write the launch brief" })).toBeVisible();
  });

  test("a row opens the item beside the list, and removing the tag there takes it off the page", async ({ page }) => {
    await page.goto("/dev/tags/errands");
    await page.getByRole("button", { name: "Renew passport" }).click();
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue("Renew passport");

    await details.getByRole("button", { name: "Remove tag errands" }).click();
    await expect(page.getByRole("button", { name: "Renew passport" })).toHaveCount(0);
    await expect(page.getByText("3 open, 1 done.")).toBeVisible();
  });

  test("a name that is no tag says so", async ({ page }) => {
    await page.goto("/dev/tags/nothing-here");
    await expect(page.getByText("No tag is called nothing-here.")).toBeVisible();
  });
});

test("settings: a tag can be renamed, and deleted after a yes", async ({ page }) => {
  await page.goto("/dev/settings");
  const tags = page.getByRole("region", { name: "Tags" });
  const travel = tags.getByRole("textbox", { name: "Rename #travel", exact: true });
  await expect(travel).toHaveValue("travel");

  await travel.fill("#trips");
  await travel.press("Enter");
  const trips = tags.getByRole("textbox", { name: "Rename #trips", exact: true });
  await expect(trips).toHaveValue("trips");

  await tags.getByRole("button", { name: "Delete #trips" }).click();
  await tags.getByRole("group", { name: "Delete #trips? Its items stay." }).getByRole("button", { name: "Yes" }).click();
  await expect(trips).toHaveCount(0);
  await expect(tags.getByRole("listitem")).toHaveCount(4);
});

test.describe("inbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/inbox");
  });

  test("an item can be planned for a picked day, and leaves the inbox", async ({ page }) => {
    const list = page.getByRole("region", { name: "Waiting" });
    const later = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

    await list.getByRole("button", { name: "Plan for: Return the library books" }).click();
    const choices = list.getByRole("group", { name: "Plan Return the library books for" });
    await expect(choices.getByRole("button", { name: "Today" })).toBeFocused();
    await choices.getByLabel("Another day").fill(later);
    await choices.getByRole("button", { name: "Plan", exact: true }).click();

    await expect(
      page.getByRole("status").filter({ hasText: /^Return the library books is planned for \w+day \d+ \w+\.$/ }),
    ).toBeVisible();
    await expect(list.getByRole("button", { name: "Return the library books" })).toHaveCount(0);
    await expect(page.getByText("4 items waiting.")).toBeVisible();
  });

  test("Escape closes the day choices and returns to the button", async ({ page }) => {
    const list = page.getByRole("region", { name: "Waiting" });
    const plan = list.getByRole("button", { name: "Plan for: Book the dentist" });

    await plan.click();
    await expect(list.getByRole("group", { name: "Plan Book the dentist for" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(list.getByRole("group")).toHaveCount(0);
    await expect(plan).toBeFocused();
    await expect(plan).toHaveAttribute("aria-expanded", "false");
  });

  test("a tick marks an item done in place, and can be undone", async ({ page }) => {
    const done = page.getByRole("checkbox", { name: "Done: Book the dentist" });

    await done.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: "Book the dentist is done." })).toBeVisible();
    await expect(done).toBeChecked();
    await expect(page.getByText("4 items waiting.")).toBeVisible();

    await done.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: "Book the dentist is open again." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Plan for: Book the dentist" })).toBeVisible();
  });

  test("a failed plan puts the item back and says so", async ({ page }) => {
    await page.getByLabel("Make saves fail").check();
    await page.getByRole("button", { name: "Plan for: Book the dentist" }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();

    await expect(page.getByRole("status").filter({ hasText: "That move did not save, so it is back where it was. Try again." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Plan for: Book the dentist" })).toBeFocused();
  });

  test("a title opens the item beside the list", async ({ page }) => {
    await page.getByRole("button", { name: /^Pack for the coast/ }).click();
    await expect(page).toHaveURL(/\?item=f2000000-0000-4000-8000-000000000003$/);
    await expect(
      page.getByRole("complementary", { name: "Details" }).getByRole("heading", { name: "Pack for the coast" }),
    ).toBeVisible();
  });

  test("an empty inbox says so", async ({ page }) => {
    await page.goto("/dev/inbox?empty");
    await expect(page.getByText("Nothing is waiting.")).toBeVisible();
    await expect(page.getByText("Anything you capture without a day lands here, safe until you plan it.")).toBeVisible();

    await page.getByLabel("Capture anything").fill("Fix the gate");
    await page.getByLabel("Capture anything").press("Enter");
    await expect(page.getByRole("button", { name: "Plan for: Fix the gate" })).toBeVisible();
    await expect(page.getByText("1 item waiting.")).toBeVisible();
  });
});

test.describe("lists", () => {
  test("checklists show open first with their progress, a repeating one once", async ({ page }) => {
    await page.goto("/dev/lists");
    await expect(page.getByRole("heading", { level: 1, name: "Lists" })).toBeVisible();
    await expect(page.getByText("4 open, 1 done.")).toBeVisible();
    await expect(page.getByRole("list").first().getByRole("button")).toHaveText([
      "Ideas for the garden",
      "Pack for the coast",
      "Launch day",
      /^Weekly reset\s*, repeats$/,
      "Move the flat, done",
    ]);
    await expect(page.getByRole("button", { name: "Pack for the coast" })).toHaveAccessibleDescription("1 of 3 done Home");
    await expect(page.getByRole("button", { name: /^Weekly reset/ })).toHaveAccessibleDescription(
      "Repeats every week on Sunday",
    );
    await expect(page.getByRole("button", { name: "Ideas for the garden" })).toHaveAccessibleDescription("No lines yet");
  });

  test("a row opens the checklist beside the list, and ticking a line there moves its progress", async ({ page }) => {
    await page.goto("/dev/lists");
    const row = page.getByRole("button", { name: "Pack for the coast" });
    await row.click();
    await expect(page).toHaveURL(/\?item=f3000000-0000-4000-8000-000000000001$/);
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue("Pack for the coast");

    // The box is drawn by a glyph over a visually hidden input, so it is ticked from the keyboard.
    await details.getByRole("checkbox", { name: "Sunscreen" }).focus();
    await page.keyboard.press("Space");
    await expect(row).toHaveAccessibleDescription("2 of 3 done Home");
  });

  test("a new checklist opens at once, ready for its lines", async ({ page }) => {
    await page.goto("/dev/lists?empty");
    await expect(page.getByText("No checklists yet.")).toBeVisible();
    await expect(page.getByText(/^A checklist keeps the small steps of one thing together/)).toBeVisible();

    const field = page.getByLabel("New checklist");
    await field.fill("Groceries for Sunday");
    await field.press("Enter");
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue("Groceries for Sunday");
    await expect(page.getByText("1 checklist open.")).toBeVisible();

    await details.getByRole("textbox", { name: "Add a subtask" }).fill("Bread");
    await details.getByRole("textbox", { name: "Add a subtask" }).press("Enter");
    await expect(page.getByRole("button", { name: "Groceries for Sunday" })).toHaveAccessibleDescription("0 of 1 done");
  });

  test("a failed capture keeps the words and says so", async ({ page }) => {
    await page.goto("/dev/lists");
    await page.getByLabel("Make every save fail").check();
    const field = page.getByLabel("New checklist");
    await field.fill("Car service");
    await field.press("Enter");
    await expect(page.getByText("That did not save. Your words are still here, so try again.")).toBeVisible();
    await expect(field).toHaveValue("Car service");
    await expect(page.getByRole("complementary", { name: "Details" })).toHaveCount(0);
  });
});

const SWITCHES = [
  { path: "/dev/score", from: "Book the dentist", to: "Take vitamins" },
  { path: "/dev/week", from: "Renew passport", to: "Book the dentist" },
  { path: "/dev/inbox", from: "Pack for the coast", to: "Return the library books" },
];

for (const { path, from, to } of SWITCHES) {
  test(`${path}: while the next item opens, the one still showing cannot be used`, async ({ page }) => {
    await page.goto(path);
    const details = page.getByRole("complementary", { name: "Details" });
    const insideInert = () => details.locator("h2").evaluate((h) => h.closest("[inert]") !== null);
    await page.getByRole("button", { name: new RegExp(`^${from},?`) }).first().click();
    await expect(details.getByRole("heading", { name: from })).toBeVisible();
    await expect(details).toHaveAttribute("aria-busy", "false");

    // Holds the server's answer for the next item, so the switch stays part way for as long as the test needs.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.searchParams.has("_rsc"),
      async (route) => {
        await held;
        await route.continue();
      },
    );
    await page.getByRole("button", { name: new RegExp(`^${to},?`) }).first().click();

    await expect(details).toHaveAttribute("aria-busy", "true");
    await expect(details.getByRole("heading", { name: from })).toBeVisible();
    expect(await insideInert()).toBe(true);

    release();
    await expect(details.getByRole("heading", { name: to })).toBeVisible();
    await expect(details).toHaveAttribute("aria-busy", "false");
    expect(await insideInert()).toBe(false);
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("a row opens its details in view with focus there, and Close returns focus to the row", async ({ page }) => {
    await page.goto("/dev/lists");
    const row = page.getByRole("button", { name: "Launch day" });
    await row.click();
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue("Launch day");

    await expect(details.first()).toBeFocused();
    await expect(details.getByRole("link", { name: "Close details" })).toBeInViewport();
    await expect(details.getByRole("textbox", { name: "Title" })).toBeInViewport();

    await details.getByRole("link", { name: "Close details" }).click();
    await expect(details).toHaveCount(0);
    await expect(row).toBeFocused();
    await expect(row).toBeInViewport();
  });

  test("a beam opens its details in view with focus there", async ({ page }) => {
    await page.goto("/dev/score");
    await page.getByRole("button", { name: /^Design sync, / }).click();
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("heading", { name: "Design sync" })).toBeInViewport();
    await expect(details.first()).toBeFocused();
  });
});

test("with a mouse, the Score keeps its keyboard help behind a ? and shows no press-and-hold hint", async ({ page }) => {
  await page.goto("/dev/score");
  const keys = page.getByText(/^Drag a beam to move it/);
  await expect(keys).toBeHidden();
  const help = page.getByRole("button", { name: "Keyboard help" });
  await help.hover();
  await expect(keys).toBeVisible();
  expect(await keys.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(100);
  await page.mouse.move(0, 0);
  await expect(keys).toBeHidden();
  await help.focus();
  await expect(keys).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(keys).toBeHidden();
  await expect(page.getByRole("button", { name: "Keyboard help" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(/^Drag one onto an area/)).toBeVisible();
  await expect(page.locator("kbd", { hasText: /^C$/ })).toBeVisible();
  await expect(page.getByText(/Press and hold/)).toHaveCount(2);
  for (const hint of await page.getByText(/Press and hold/).all()) await expect(hint).toBeHidden();
});

test.describe("on a touch phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("the Score says to press and hold before dragging, and keeps the key help for screen readers", async ({
    page,
  }) => {
    await page.goto("/dev/score");
    await expect(page.getByText(/^Press and hold a beam, then drag it/)).toBeVisible();
    await expect(page.getByText(/^Press and hold one, then drag it onto an area/)).toBeVisible();
    await expect(page.getByText(/^Drag one onto an area/)).toBeHidden();
    await expect(page.locator("kbd", { hasText: /^C$/ })).toBeHidden();

    const keys = page.getByText(/^Drag a beam to move it/);
    await expect(keys).toBeHidden();
    await page.getByRole("button", { name: "Keyboard help" }).tap();
    await expect(keys).toBeVisible();
    await expect(page.getByRole("button", { name: /^Design sync, / })).toHaveAccessibleDescription(
      /Space marks it done/,
    );
  });

  test("the detail panel's icon buttons are 44px touch targets, and a tag's remove button at least 24px", async ({
    page,
  }) => {
    await page.goto("/dev/detail?item=00000000-0000-4000-8000-000000000001");
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("button", { name: /^Make .* a task$/ }).first()).toBeVisible();
    await expect(details.getByRole("button", { name: /^Remove tag / }).first()).toBeVisible();
    const small = await details.locator("button").evaluateAll((buttons: HTMLButtonElement[]) =>
      buttons
        .filter((b) => b.offsetParent && !b.textContent?.trim())
        .map((b) => ({ name: b.getAttribute("aria-label") ?? "", ...b.getBoundingClientRect().toJSON() }))
        .filter((r) => {
          const min = r.name.startsWith("Remove tag ") ? 24 : 44;
          return r.width < min || r.height < min;
        })
        .map((r) => `${r.name} ${r.width}x${r.height}`),
    );
    expect(small).toEqual([]);
  });
});
